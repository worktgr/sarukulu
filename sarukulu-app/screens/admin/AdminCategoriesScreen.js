// screens/admin/AdminCategoriesScreen.js
import { useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, ActivityIndicator, FlatList, Pressable, Alert, Image
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import SortMenu from './components/SortMenu';
import CategoryFormModal from './components/CategoryFormModal';
import EditCategoryFormModal from './components/EditCategoryFormModal';

export default function AdminCategoriesScreen() {
  const [list, setList] = useState([]);
  const [sortMode, setSortMode] = useState('custom'); // 'custom' | 'active' | 'name'
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, [sortMode]);

  async function load() {
    setLoading(true);
    setMsg('');
    let q = supabase
      .from('categories')
      .select('id,name,sort_order,is_active,image_url,image_path');

    if (sortMode === 'custom') {
      q = q.order('sort_order', { ascending: true, nullsFirst: false }).order('name', { ascending: true });
    } else if (sortMode === 'active') {
      q = q.order('is_active', { ascending: false }).order('name', { ascending: true });
    } else {
      q = q.order('name', { ascending: true });
    }

    const { data, error } = await q;
    if (error) { setMsg(error.message || 'Load failed'); setList([]); }
    else { setList(data || []); }
    setLoading(false);
  }

  async function toggleActiveQuick(cat) {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: !cat.is_active })
        .eq('id', cat.id);
      if (error) throw error;
      await load();
    } catch (e) {
      Alert.alert('Update failed', e.message || 'Unknown error');
    }
  }

  async function onDelete(cat) {
    Alert.alert('Delete category?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const path =
              cat.image_path ||
              (cat.image_url
                ? cat.image_url.split('/object/public/product-images/')[1]?.split('?')[0]
                : null);
            if (path) { try { await supabase.storage.from('product-images').remove([path]); } catch {} }

            const { error } = await supabase.from('categories').delete().eq('id', cat.id);
            if (error) {
              if (error.code === '23503') {
                Alert.alert('Cannot delete', 'Products exist in this category. Deactivate it instead.');
              } else {
                Alert.alert('Delete failed', error.message || 'Unknown error');
              }
            } else {
              try { await supabase.rpc('normalize_category_order_seq'); } catch {}
              await load();
            }
          } catch (e) {
            Alert.alert('Delete failed', e.message || 'Unknown error');
          }
        }
      }
    ]);
  }

  const renderItem = ({ item }) => (
    <View style={{
      borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, marginBottom: 12,
      backgroundColor: '#fff'
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* Image */}
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={{ width: 60, height: 60, borderRadius: 8 }} />
        ) : (
          <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, color: '#999' }}>No image</Text>
          </View>
        )}

        {/* Info */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontWeight: '700' }}>
            {item.name}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {/* sort badge */}
            <View style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 12, color: '#666' }}>Sort: {item.sort_order ?? '—'}</Text>
            </View>
            {/* active badge */}
            <View style={{
              borderWidth: 1, borderColor: item.is_active ? '#d1fae5' : '#fde68a',
              backgroundColor: item.is_active ? '#ecfdf5' : '#fffbeb',
              borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2
            }}>
              <Text style={{ fontSize: 12, color: item.is_active ? '#047857' : '#92400e' }}>
                {item.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => { setEditing(item); setShowEdit(true); }} hitSlop={8} style={{ padding: 6, borderWidth: 1, borderRadius: 8 }}>
            <MaterialIcons name="edit" size={18} />
          </Pressable>
          <Pressable onPress={() => toggleActiveQuick(item)} hitSlop={8} style={{ padding: 6, borderWidth: 1, borderRadius: 8 }}>
            <MaterialIcons name={item.is_active ? 'visibility' : 'visibility-off'} size={18} />
          </Pressable>
          <Pressable onPress={() => onDelete(item)} hitSlop={8} style={{ padding: 6, borderWidth: 1, borderRadius: 8 }}>
            <MaterialIcons name="delete" size={18} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex:1, padding:16 }}>
      <View style={{ flexDirection:'row', alignItems:'center', marginBottom:12 }}>
        <Text style={{ fontSize:22, fontWeight:'700', flex:1 }}>Categories</Text>
        <SortMenu value={sortMode} onChange={setSortMode} />
        <Pressable onPress={() => setShowCreate(true)} style={{ marginLeft:8, borderWidth:1, borderRadius:10, padding:8 }}>
          <MaterialIcons name="add" size={20} />
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 12 }}>{msg || 'Loading…'}</Text>
        </View>
      ) : (
        <FlatList data={list} keyExtractor={(it) => String(it.id)} renderItem={renderItem} />
      )}

      <CategoryFormModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={() => { setShowCreate(false); load(); }}
      />
      <EditCategoryFormModal
        visible={showEdit}
        initial={editing}
        onClose={() => setShowEdit(false)}
        onSaved={() => { setShowEdit(false); load(); }}
      />
    </SafeAreaView>
  );
}
