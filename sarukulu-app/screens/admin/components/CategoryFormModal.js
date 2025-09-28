// screens/admin/components/CategoryFormModal.js
import { useEffect, useState } from 'react';
import {
  Modal, SafeAreaView, View, Text, TextInput, Pressable, Switch,
  ScrollView, Image, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../../../lib/supabase';

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export default function CategoryFormModal({ visible, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState(''); // 1..N (optional)
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nameErr, setNameErr] = useState('');
  const [posErr, setPosErr] = useState('');
  const [msg, setMsg] = useState('');

  const [pickedUri, setPickedUri] = useState(null);
  const [pickedMeta, setPickedMeta] = useState(null);

  useEffect(() => {
    if (visible) {
      setName(''); setPosition(''); setActive(true);
      setSaving(false); setNameErr(''); setPosErr(''); setMsg('');
      setPickedUri(null); setPickedMeta(null);
    }
  }, [visible]);

  const normalizeName = (n) => (n || '').replace(/\s+/g, ' ').trim();

  function validate() {
    const n = normalizeName(name);
    let ok = true;
    if (!n) { setNameErr('Name is required'); ok = false; }
    else if (n.length < 2) { setNameErr('Name is too short'); ok = false; }
    else if (n.length > 60) { setNameErr('Name is too long'); ok = false; }
    else setNameErr('');

    if (position !== '') {
      const num = Number(position);
      if (!Number.isFinite(num) || num < 1) { setPosErr('Enter a valid position (1..N)'); ok = false; }
      else setPosErr('');
    } else setPosErr('');
    return ok;
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      // Expo SDK 51+: use the new array form
      mediaTypes: ['images'],
      quality: 1
    });
    if (!res.canceled) {
      const a = res.assets[0];
      setPickedUri(a.uri);
      setPickedMeta({ uri: a.uri, width: a.width, height: a.height });
    }
  }

  async function processImage(meta) {
    if (!meta?.uri) return null;
    const MAX_SIDE = 1024;
    const w = meta.width || 0, h = meta.height || 0;
    const actions = [];
    if (w && h) {
      const L = Math.max(w, h);
      if (L > MAX_SIDE) actions.push(w >= h ? { resize: { width: MAX_SIDE } } : { resize: { height: MAX_SIDE } });
    }
    try {
      const out = await ImageManipulator.manipulateAsync(
        meta.uri, actions, { compress: 0.8, format: ImageManipulator.SaveFormat.WEBP }
      );
      const resp = await fetch(out.uri); const ab = await resp.arrayBuffer();
      return { arrayBuffer: ab, mime: 'image/webp', ext: 'webp' };
    } catch {
      const out = await ImageManipulator.manipulateAsync(
        meta.uri, actions, { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      const resp = await fetch(out.uri); const ab = await resp.arrayBuffer();
      return { arrayBuffer: ab, mime: 'image/jpeg', ext: 'jpg' };
    }
  }

  async function precheckDuplicateSlug(slug) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', slug)
        .limit(1)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return !!data?.id;
    } catch {
      return false;
    }
  }

  async function onCreate() {
    setMsg('');
    if (!validate()) return;

    const n = normalizeName(name);
    const slug = slugify(n);
    const desiredPos = position !== '' ? Math.max(1, Number(position)) : null;

    const slugTaken = await precheckDuplicateSlug(slug);
    if (slugTaken) { setNameErr('A category with this name already exists'); return; }

    setSaving(true);
    try {
      // 1) Insert WITHOUT sort_order (DB will place it; we then move/normalize)
      const { data: created, error } = await supabase
        .from('categories')
        .insert([{ name: n, slug, is_active: active }])
        .select('id')
        .single();
      if (error) throw error;

      // 2) Optional image upload
      if (pickedMeta && created?.id) {
        const processed = await processImage(pickedMeta);
        if (!processed) throw new Error('Could not process image');
        const path = `categories/${created.id}_${Date.now()}.${processed.ext}`;
        const { error: upErr } = await supabase
          .storage
          .from('product-images')
          .upload(path, new Uint8Array(processed.arrayBuffer), {
            contentType: processed.mime, upsert: true, cacheControl: '3600'
          });
        if (upErr) throw upErr;

        const { data: pub } = await supabase.storage.from('product-images').getPublicUrl(path);
        const publicUrl = pub?.publicUrl ? `${pub.publicUrl}?v=${Date.now()}` : null;

        const { error: upd } = await supabase
          .from('categories')
          .update({ image_url: publicUrl, image_path: path })
          .eq('id', created.id);
        if (upd) throw upd;
      }

      // 3) Positioning / normalization (1..N only)
      if (desiredPos !== null) {
        await supabase.rpc('set_category_position', { _id: created.id, _pos: desiredPos });
      } else {
        try { await supabase.rpc('normalize_category_order_seq'); } catch {}
      }

      onSaved?.();
      onClose?.();
    } catch (e) {
      setMsg(e.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex:1, backgroundColor:'#fff' }}>
        <View style={{ flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderColor:'#eee' }}>
          <Text style={{ fontSize:18, fontWeight:'700', flex:1 }}>Create Category</Text>
          <Pressable onPress={onClose} style={{ borderWidth:1, borderRadius:8, paddingHorizontal:12, paddingVertical:8 }}>
            <Text>Close</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding:16, paddingBottom:24 }}>
          <Text>Name</Text>
          <TextInput
            placeholder="e.g. Fruits & Vegetables"
            value={name}
            onChangeText={(t) => { setName(t); if (nameErr) setNameErr(''); }}
            style={{ borderWidth:1, borderColor: nameErr ? '#f00' : '#ddd', borderRadius:8, padding:12, marginBottom:4 }}
          />
          {nameErr ? <Text style={{ color:'#d00', marginBottom:8 }}>{nameErr}</Text> : null}

          <Text style={{ marginTop:8 }}>Position (optional, 1..N)</Text>
          <TextInput
            placeholder="e.g. 1 (top), 2, 3…"
            value={position}
            onChangeText={(t) => { setPosition(t); if (posErr) setPosErr(''); }}
            keyboardType="number-pad"
            style={{ borderWidth:1, borderColor: posErr ? '#f00' : '#ddd', borderRadius:8, padding:12, marginBottom:4 }}
          />
          {posErr ? <Text style={{ color:'#d00', marginBottom:8 }}>{posErr}</Text> : null}

          <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:8, marginBottom:12 }}>
            <Switch value={active} onValueChange={setActive} />
            <Text>Active</Text>
          </View>

          <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:16 }}>
            <Pressable onPress={pickImage} style={{ borderWidth:1, borderRadius:8, padding:10 }}>
              <Text>{pickedUri ? 'Change Image' : 'Pick Image'}</Text>
            </Pressable>
            {pickedUri ? <Image source={{ uri: pickedUri }} style={{ width:56, height:56, borderRadius:8 }} /> : null}
          </View>

          {msg ? <Text style={{ color:'#666', marginBottom:12 }}>{msg}</Text> : null}

          <View style={{ flexDirection:'row', gap:12 }}>
            <Pressable
              onPress={onCreate}
              disabled={saving}
              style={{ borderWidth:1, borderRadius:8, padding:12, backgroundColor:'#eef7ff', opacity: saving ? 0.6 : 1 }}
            >
              <Text style={{ fontWeight:'700' }}>{saving ? 'Creating…' : 'Create'}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={{ borderWidth:1, borderRadius:8, padding:12 }}>
              <Text>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
