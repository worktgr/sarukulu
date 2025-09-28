// screens/MyOrdersScreen.js
import { useEffect, useState, useCallback } from 'react';
import { SafeAreaView, View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';

function formatINR(n) {
  return `₹${Number(n).toFixed(2)}`;
}

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function MyOrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) { setOrders([]); setLoading(false); return; }

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, status, subtotal, delivery_fee, total, created_at,
        order_items (
          id, qty, price,
          product:products ( id, name ),
          variant:product_variants ( id, name, pack_size_label )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('orders load error:', error);
      setOrders([]);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Loading orders…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'700', marginBottom:12 }}>My Orders</Text>

      {orders.length === 0 ? (
        <Text>No orders yet.</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const itemsCount = (item.order_items || []).reduce((s, it) => s + (it.qty || 0), 0);
            const firstLine = (item.order_items?.[0]?.product?.name || 'Items') +
              (item.order_items?.[0]?.variant?.pack_size_label ? ` (${item.order_items[0].variant.pack_size_label})` : '');
            return (
              <View style={{ padding:12, borderWidth:1, borderColor:'#eee', borderRadius:12, marginBottom:12 }}>
                <Text style={{ fontWeight:'700' }}>Order #{item.id} • {item.status.replaceAll('_',' ')}</Text>
                <Text style={{ color:'#666', marginTop:4 }}>{formatDate(item.created_at)}</Text>
                <Text style={{ marginTop:6 }}>{firstLine}{itemsCount > 1 ? ` + ${itemsCount - 1} more` : ''}</Text>
                <Text style={{ marginTop:6, fontWeight:'700' }}>Total: {formatINR(item.total)}</Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
