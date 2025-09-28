// screens/admin/AdminHomeScreen.js
import { useEffect, useState } from 'react';
import { SafeAreaView, Text, Pressable, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AdminHomeScreen({ navigation }) {
  const [role, setRole] = useState('checking');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return setRole('none');
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setRole(data?.role || 'customer');
    })();
  }, []);

  if (role === 'checking') {
    return (
      <SafeAreaView style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <Text>Checking admin access…</Text>
      </SafeAreaView>
    );
  }

  if (role !== 'admin' && role !== 'manager') {
    return (
      <SafeAreaView style={{ flex:1, justifyContent:'center', alignItems:'center', padding:16 }}>
        <Text style={{ fontWeight:'700', marginBottom:8 }}>No access</Text>
        <Text style={{ color:'#666', textAlign:'center' }}>
          Your account isn’t an admin/manager. If this is a mistake, update your profile role in Supabase.
        </Text>
      </SafeAreaView>
    );
  }

  const Card = ({ title, subtitle, onPress }) => (
    <Pressable onPress={onPress} style={{ borderWidth:1, borderRadius:12, padding:14, marginBottom:12, backgroundColor:'#fff' }}>
      <Text style={{ fontWeight:'700' }}>{title}</Text>
      <Text style={{ color:'#666', marginTop:4 }}>{subtitle}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'700', marginBottom:12 }}>Admin</Text>

      <Card
        title="Manage Categories"
        subtitle="Create, edit, delete, and set images"
        onPress={() => navigation.navigate('AdminCategories')}
      />

      <Card
        title="Manage Users"
        subtitle="Admins, managers, and delivery only"
        onPress={() => navigation.navigate('AdminUsers')}
      />
    </SafeAreaView>
  );
}
