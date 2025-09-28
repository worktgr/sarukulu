// screens/AddressScreen.js
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';


export default function AddressScreen() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);


  // form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');

  const canSave = useMemo(() => {
    const ph = phone.replace(/\D/g, '');
    const pin = pincode.replace(/\D/g, '');
    return name.trim().length >= 2 &&
           ph.length >= 10 &&
           line1.trim().length >= 3 &&
           city.trim().length >= 2 &&
           pin.length === 6;
  }, [name, phone, line1, city, pincode]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      if (!user?.id) { setLoading(false); return; }
      await refresh(user.id);
      setLoading(false);
    })();
  }, []);

  async function refresh(uid = userId) {
    if (!uid) return;
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', uid)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      Alert.alert('Error loading addresses', error.message);
      return;
    }
    setAddresses(data || []);
  }

  async function saveAddress() {
    if (!userId) return;
    if (!canSave) {
      Alert.alert('Missing info', 'Please fill name, phone, address line, city, and 6-digit pincode.');
      return;
    }
    setSaving(true);
    try {
      // make first address default automatically
      const makeDefault = addresses.length === 0;

      const { error } = await supabase
  .from('addresses')
  .insert([{
    user_id: userId,
    name: name.trim(),
    phone: phone.trim(),
    line1: line1.trim(),
    line2: line2.trim(),
    landmark: landmark.trim(),
    city: city.trim(),
    pincode: pincode.trim(),
    is_default: makeDefault,
    lat,            // <— add
    lon             // <— add
  }]);


      if (error) throw error;

      // clear form
      setName(''); setPhone(''); setLine1(''); setLine2(''); setLandmark(''); setCity(''); setPincode('');
      await refresh();
      Alert.alert('Saved', 'Address added.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeAddress(id) {
    Alert.alert('Delete address?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('addresses').delete().eq('id', id).eq('user_id', userId);
        if (error) Alert.alert('Error', error.message);
        else await refresh();
      }}
    ]);
  }

  async function useCurrentLocation() {
  try {
    // Ask permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow location to auto-fill your address.');
      return;
    }

    // Get coordinates
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = pos.coords;
    setLat(latitude);
    setLon(longitude);

    // Reverse-geocode to human address
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const a = results?.[0] || {};
    // Best-effort fills:
    setCity(a.city || a.subregion || a.region || '');
    setPincode(a.postalCode || '');
    const lineGuess = [a.name, a.street].filter(Boolean).join(', ');
    if (!line1) setLine1(lineGuess);
    if (!name) setName(a.name || name); // optional
  } catch (e) {
    Alert.alert('Location error', e.message);
  }
}


  async function makeDefault(id) {
    // unset existing defaults, then set one default
    const { error: e1 } = await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
    if (e1) { Alert.alert('Error', e1.message); return; }
    const { error: e2 } = await supabase.from('addresses').update({ is_default: true }).eq('id', id).eq('user_id', userId);
    if (e2) { Alert.alert('Error', e2.message); return; }
    await refresh();
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={{ flex:1, justifyContent:'center', alignItems:'center', padding:16 }}>
        <Text>Please sign in to manage addresses.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'700', marginBottom:12 }}>Add Address</Text>

      <View style={{ gap:10 }}>
        <TextInput placeholder="Full name" value={name} onChangeText={setName}
          style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:12 }} />
        <TextInput placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad"
          style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:12 }} />
        <TextInput placeholder="Address line 1" value={line1} onChangeText={setLine1}
          style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:12 }} />
        <TextInput placeholder="Address line 2 (optional)" value={line2} onChangeText={setLine2}
          style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:12 }} />
        <TextInput placeholder="Landmark (optional)" value={landmark} onChangeText={setLandmark}
          style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:12 }} />
        <TextInput placeholder="City" value={city} onChangeText={setCity}
          style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:12 }} />
        <TextInput placeholder="Pincode (6 digits)" value={pincode} onChangeText={setPincode} keyboardType="number-pad" maxLength={6}
          style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:12 }} />

        <Pressable
          onPress={saveAddress}
          disabled={!canSave || saving}
          style={{
            opacity: (!canSave || saving) ? 0.5 : 1,
            marginTop:4, padding:14, borderRadius:12, borderWidth:1, alignItems:'center'
          }}
        >
          <Text style={{ fontWeight:'700' }}>{saving ? 'Saving…' : 'Save Address'}</Text>
        </Pressable>
      </View>

      <Text style={{ fontSize:18, fontWeight:'700', marginTop:20, marginBottom:8 }}>Your Addresses</Text>
      <Pressable
  onPress={useCurrentLocation}
  style={{ marginTop:4, marginBottom:8, padding:12, borderWidth:1, borderRadius:8, alignItems:'center' }}
>
  <Text>Use my current location</Text>
</Pressable>

      {addresses.length === 0 ? (
        <Text>No addresses yet.</Text>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(a) => String(a.id)}
          renderItem={({ item }) => (
            <View style={{ padding:12, borderWidth:1, borderColor:'#eee', borderRadius:12, marginBottom:12 }}>
              <Text style={{ fontWeight:'700' }}>
                {item.name} {item.is_default ? ' • Default' : ''}
              </Text>
              <Text style={{ color:'#444', marginTop:4 }}>
                {item.line1}{item.line2 ? `, ${item.line2}` : ''}{item.landmark ? `, ${item.landmark}` : ''}
              </Text>
              <Text style={{ color:'#444' }}>{item.city} - {item.pincode}</Text>
              <Text style={{ color:'#666', marginTop:4 }}>📞 {item.phone}</Text>
              <View style={{ flexDirection:'row', gap:12, marginTop:8 }}>
                {!item.is_default && (
                  <Pressable onPress={() => makeDefault(item.id)} style={{ paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderRadius:8 }}>
                    <Text>Make Default</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => removeAddress(item.id)} style={{ paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderRadius:8 }}>
                  <Text>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
