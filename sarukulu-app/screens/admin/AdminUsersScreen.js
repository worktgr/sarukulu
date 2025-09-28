// screens/admin/AdminUsersScreen.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView, View, Text, FlatList, ActivityIndicator, Pressable, Alert, TextInput, Keyboard
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import RolePickerModal from './components/RolePickerModal';

const STAFF_ROLES = ['admin', 'manager', 'delivery'];

function Badge({ text, bg = '#eef2ff', fg = '#3730a3' }) {
  return (
    <View style={{ borderWidth:1, borderColor:bg, backgroundColor:bg, borderRadius:999, paddingHorizontal:8, paddingVertical:2 }}>
      <Text style={{ fontSize:12, color:fg }}>{text}</Text>
    </View>
  );
}

function UserCard({ item, onPickRole, showRole = true, highlight = false }) {
  const colorByRole = (r) =>
    r === 'admin' ? { bg: '#ecfdf5', fg: '#047857' }
    : r === 'manager' ? { bg: '#eff6ff', fg: '#1d4ed8' }
    : r === 'delivery' ? { bg: '#fffbeb', fg: '#92400e' }
    : { bg: '#f3f4f6', fg: '#374151' };

  const { bg, fg } = colorByRole(item.role || 'customer');

  return (
    <View style={{
      borderWidth:1, borderColor: highlight ? '#c7d2fe' : '#eee',
      backgroundColor: '#fff', borderRadius:12, padding:12, marginBottom:12
    }}>
      <View style={{ flexDirection:'row', alignItems:'center' }}>
        <View style={{ flex:1, minWidth:0 }}>
          <Text numberOfLines={1} style={{ fontWeight:'700' }}>{item.name || '—'}</Text>
          <View style={{ flexDirection:'row', gap:8, marginTop:6, flexWrap:'wrap' }}>
            {showRole ? <Badge text={`Role: ${item.role || 'customer'}`} bg={bg} fg={fg} /> : null}
            {item.phone ? <Badge text={item.phone} /> : null}
            <Badge text={`id: ${String(item.id).slice(0,8)}…`} />
          </View>
        </View>
        <View style={{ flexDirection:'row', gap:8 }}>
          <Pressable
            onPress={() => onPickRole?.(item)}
            hitSlop={8}
            style={{ padding:6, borderWidth:1, borderRadius:8 }}
          >
            <MaterialIcons name="manage-accounts" size={18} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function AdminUsersScreen() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // role change modal
  const [openPicker, setOpenPicker] = useState(false);
  const [selected, setSelected] = useState(null);

  // phone search
  const [phoneQuery, setPhoneQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]); // includes customers

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setMsg('');
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, phone, role, created_at, updated_at')
      .in('role', STAFF_ROLES)
      .order('role', { ascending: true })
      .order('name', { ascending: true, nullsFirst: true });
    if (error) { setMsg(error.message || 'Load failed'); setList([]); }
    else { setList(data || []); }
    setLoading(false);
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const onPickRole = useCallback((user) => {
    setSelected(user);
    setOpenPicker(true);
  }, []);

  const onConfirmRole = useCallback(async (role) => {
    if (!selected) return;
    setOpenPicker(false);

    try {
      const { error } = await supabase.rpc('set_user_role', { _target: selected.id, _role: role });
      if (error) throw error;

      // If they were a customer found via search, refresh both lists
      await Promise.all([loadStaff(), phoneQuery ? performSearch(phoneQuery, true) : Promise.resolve()]);
    } catch (e) {
      const m = e?.message || String(e) || 'Update failed';
      if (/last admin/i.test(m)) Alert.alert('Not allowed', 'You cannot demote the last admin.');
      else Alert.alert('Update failed', m);
    } finally {
      setSelected(null);
    }
  }, [selected, loadStaff, phoneQuery]);

  async function performSearch(q, keepKeyboard = false) {
    const query = (q || '').trim();
    if (!query) { setResults([]); return; }
    setSearching(true); setMsg('');
    try {
      // Case-insensitive partial match on phone; RLS allows admin to read any profile via helper
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, phone, role')
        .ilike('phone', `%${query}%`)
        .order('role', { ascending: true })
        .order('name', { ascending: true, nullsFirst: true })
        .limit(20);
      if (error) throw error;
      setResults(data || []);
    } catch (e) {
      setMsg(e.message || 'Search failed');
      setResults([]);
    } finally {
      setSearching(false);
      if (!keepKeyboard) Keyboard.dismiss();
    }
  }

  return (
    <SafeAreaView style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'700', marginBottom:8 }}>Users</Text>

      {/* Phone search box */}
      <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
        <TextInput
          placeholder="Search by phone (e.g. 98765 or +91...)"
          value={phoneQuery}
          onChangeText={setPhoneQuery}
          onSubmitEditing={() => performSearch(phoneQuery)}
          style={{ flex:1, borderWidth:1, borderColor:'#ddd', borderRadius:10, paddingHorizontal:12, paddingVertical:10, backgroundColor:'#fff' }}
          keyboardType="phone-pad"
          returnKeyType="search"
        />
        <Pressable
          onPress={() => performSearch(phoneQuery)}
          style={{ borderWidth:1, borderRadius:10, padding:10, backgroundColor:'#fff' }}
        >
          <MaterialIcons name="search" size={20} />
        </Pressable>
      </View>

      {/* Search results (includes customers) */}
      {phoneQuery?.trim() ? (
        <View style={{ marginBottom:12 }}>
          <Text style={{ fontWeight:'700', marginBottom:8 }}>Search results</Text>
          {searching ? (
            <View style={{ paddingVertical:12, alignItems:'center' }}>
              <ActivityIndicator />
            </View>
          ) : results.length === 0 ? (
            <Text style={{ color:'#666' }}>No users found for “{phoneQuery.trim()}”.</Text>
          ) : (
            results.map(u => (
              <UserCard
                key={String(u.id)}
                item={u}
                onPickRole={onPickRole}
                showRole
                highlight={!STAFF_ROLES.includes(u.role)}
              />
            ))
          )}
        </View>
      ) : null}

      {/* Staff list */}
      <View style={{ flex:1 }}>
        <View style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
          <Text style={{ fontWeight:'700', flex:1 }}>Staff</Text>
          <Pressable onPress={loadStaff} style={{ borderWidth:1, borderRadius:10, padding:8, backgroundColor:'#fff' }}>
            <MaterialIcons name="refresh" size={20} />
          </Pressable>
        </View>

        {loading ? (
          <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
            <ActivityIndicator size="large" />
            <Text style={{ marginTop:12 }}>{msg || 'Loading…'}</Text>
          </View>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(it) => String(it.id)}
            renderItem={({ item }) => (
              <UserCard item={item} onPickRole={onPickRole} />
            )}
            contentContainerStyle={{ paddingBottom:24 }}
            ListEmptyComponent={<Text style={{ color:'#666', textAlign:'center', marginTop:32 }}>No staff yet.</Text>}
          />
        )}
      </View>

      <RolePickerModal
        visible={openPicker}
        value={selected?.role}
        onClose={() => { setOpenPicker(false); setSelected(null); }}
        onConfirm={onConfirmRole}
      />
    </SafeAreaView>
  );
}
