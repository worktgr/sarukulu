import { useEffect, useState } from 'react';
import {
  SafeAreaView,
  Text,
  FlatList,
  View,
  ActivityIndicator,
  Pressable,
  Alert,
  TextInput,
  Button,
  Image
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from './lib/supabase';
import { CartProvider, useCart } from './store/CartContext';

// Screens split out
import CategoriesScreen from './screens/CategoriesScreen';
import AddressScreen from './screens/AddressScreen';
import MyOrdersScreen from './screens/MyOrdersScreen';
import AdminHomeScreen from './screens/admin/AdminHomeScreen';
import AdminCategoriesScreen from './screens/admin/AdminCategoriesScreen';
import AdminUsersScreen from './screens/admin/AdminUsersScreen';



const Stack = createNativeStackNavigator();

/* ---------- Auth (Email OTP) ---------- */
function AuthScreen() {
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState('request'); // 'request' | 'verify'
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const requestOtp = async () => {
    setLoading(true); setMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true }
    });
    setLoading(false);
    if (error) Alert.alert('Error', error.message);
    else { setStage('verify'); setMsg('OTP sent to your email.'); }
  };

  const verifyOtp = async () => {
    setLoading(true); setMsg('');
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email'
    });
    setLoading(false);
    if (error) Alert.alert('Invalid code', error.message);
    else setMsg('Verified! Loading…');
  };

  return (
    <SafeAreaView style={{ flex:1, padding:16, justifyContent:'center' }}>
      <Text style={{ fontSize:24, fontWeight:'700', marginBottom:12 }}>Sign in to Sarukulu</Text>
      {stage === 'request' ? (
        <>
          <Text style={{ marginBottom:8 }}>Email</Text>
          <TextInput
            value={email} onChangeText={setEmail} placeholder="you@example.com"
            autoCapitalize="none" keyboardType="email-address"
            style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:12, marginBottom:12 }}
          />
          <Button title={loading ? 'Sending…' : 'Send OTP'} onPress={requestOtp} disabled={loading || !email.includes('@')} />
        </>
      ) : (
        <>
          <Text style={{ marginBottom:8 }}>Enter 6-digit OTP sent to {email}</Text>
          <TextInput
            value={token} onChangeText={setToken} placeholder="123456"
            keyboardType="number-pad" maxLength={6}
            style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:12, marginBottom:12, letterSpacing:4 }}
          />
          <Button title={loading ? 'Verifying…' : 'Verify OTP'} onPress={verifyOtp} disabled={loading || token.length !== 6} />
          <Pressable onPress={() => setStage('request')} style={{ marginTop:16 }}>
            <Text style={{ color:'#007aff' }}>Change email</Text>
          </Pressable>
        </>
      )}
      {msg ? <Text style={{ marginTop:12, color:'#666' }}>{msg}</Text> : null}
    </SafeAreaView>
  );
}

/* ---------- Header actions (Profile / Address / Orders / Cart) ---------- */
function HeaderActions({ navigation }) {
  const { totalQty } = useCart();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return setIsAdmin(false);
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setIsAdmin(data?.role === 'admin' || data?.role === 'manager');
    })();
  }, []);

  return (
    <View style={{ flexDirection:'row' }}>
      {isAdmin && (
        <Pressable onPress={() => navigation.navigate('AdminHome')} style={{ paddingHorizontal:12, paddingVertical:6 }}>
          <Text>Admin</Text>
        </Pressable>
      )}
      <Pressable onPress={() => navigation.navigate('Profile')} style={{ paddingHorizontal:12, paddingVertical:6 }}>
        <Text>Profile</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Address')} style={{ paddingHorizontal:12, paddingVertical:6 }}>
        <Text>Address</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('MyOrders')} style={{ paddingHorizontal:12, paddingVertical:6 }}>
        <Text>Orders</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Cart')} style={{ paddingHorizontal:12, paddingVertical:6 }}>
        <Text>Cart ({totalQty})</Text>
      </Pressable>
    </View>
  );
}


/* ---------- Products (Add to Cart + Image) ---------- */
function ProductsScreen({ route }) {
  const { categoryId, categoryName } = route.params || {};
  const { addItem } = useCart();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => { (async () => {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        product_images ( url, sort_order ),
        product_variants ( id, name, pack_size_label, price, is_active, status )
      `)
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .eq('status', 'active')
      .order('name', { ascending: true });
    if (error) setErr(error.message); else setItems(data || []);
    setLoading(false);
  })(); }, [categoryId]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Loading products…</Text>
      </SafeAreaView>
    );
  }
  if (err) {
    return (
      <SafeAreaView style={{ flex:1, justifyContent:'center', alignItems:'center', padding:16 }}>
        <Text>Oops: {err}</Text>
      </SafeAreaView>
    );
  }

  const formatPrice = (n) => `₹${Number(n).toFixed(2)}`;

  return (
    <SafeAreaView style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'700', marginBottom:12 }}>{categoryName || 'Products'}</Text>

      {items.length === 0 ? (
        <Text>No products in this category yet.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const variants = (item.product_variants || []).filter(v => v.is_active && v.status === 'active');
            const minPrice = variants.length ? Math.min(...variants.map(v => Number(v.price))) : null;
            const imgs = (item.product_images || []).slice().sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
            const imgUrl = imgs[0]?.url;

            return (
              <View style={{ padding:12, borderWidth:1, borderColor:'#eee', borderRadius:12, marginBottom:12 }}>
                <View style={{ flexDirection:'row', gap:12 }}>
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={{ width:72, height:72, borderRadius:8 }} />
                  ) : null}
                  <View style={{ flex:1 }}>
                    <Text style={{ fontWeight:'700', fontSize:16 }}>{item.name}</Text>
                    {minPrice !== null && (
                      <Text style={{ marginTop:4, color:'#222' }}>from {formatPrice(minPrice)}</Text>
                    )}
                  </View>
                </View>

                {variants.length > 0 && (
                  <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:8 }}>
                    {variants.slice(0,4).map(v => {
                      const label = v.pack_size_label || v.name;
                      return (
                        <Pressable
                          key={v.id}
                          onPress={() => {
                            addItem({ variantId: v.id, name: item.name, label, price: v.price, qty: 1 });
                            Alert.alert('Added to cart', `${item.name} (${label})`);
                          }}
                          style={{
                            paddingHorizontal:10, paddingVertical:6,
                            borderWidth:1, borderColor:'#ddd', borderRadius:999, marginRight:8, marginBottom:8
                          }}
                        >
                          <Text>{label} • ₹{Number(v.price).toFixed(2)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

/* ---------- Cart (calls COD RPC) ---------- */
function CartScreen({ navigation }) {
  const { items, addItem, removeItem, clearCart, subtotal } = useCart();
  const [placing, setPlacing] = useState(false);
  const formatPrice = (n) => `₹${Number(n).toFixed(2)}`;

  const checkoutCOD = async () => {
    if (items.length === 0 || placing) return;
    try {
      setPlacing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        Alert.alert('Not signed in', 'Please sign in again.');
        return;
      }

      const { data: addr, error: addrErr } = await supabase
        .from('addresses')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

      if (addrErr) throw addrErr;
      if (!addr) {
        Alert.alert('Add address', 'Please add a default address before checkout.', [
          { text: 'Go to Address', onPress: () => navigation.navigate('Address') },
          { text: 'Cancel', style: 'cancel' }
        ]);
        return;
      }

      const payload = items.map(it => ({ variantId: it.variantId, qty: it.qty }));

      const { data, error } = await supabase.rpc('create_order_cod', {
        _address_id: addr.id,
        _items: payload,
        _notes: null
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      clearCart();
      Alert.alert(
        'Order placed 🎉',
        `Order #${row.order_id} total ${formatPrice(row.total)}`,
        [{ text: 'OK', onPress: () => navigation.popToTop() }]
      );
    } catch (e) {
      Alert.alert('Checkout error', e.message);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'700', marginBottom:12 }}>Cart</Text>

      {items.length === 0 ? (
        <Text>Your cart is empty.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.variantId)}
          renderItem={({ item }) => (
            <View style={{ padding:12, borderWidth:1, borderColor:'#eee', borderRadius:12, marginBottom:12 }}>
              <Text style={{ fontWeight:'700' }}>{item.name} ({item.label})</Text>
              <Text style={{ marginTop:4 }}>
                ₹{Number(item.price).toFixed(2)} × {item.qty} = ₹{Number(item.price * item.qty).toFixed(2)}
              </Text>
              <View style={{ flexDirection:'row', gap:12, marginTop:8 }}>
                <Pressable
                  onPress={() => addItem({ variantId: item.variantId, name: item.name, label: item.label, price: item.price, qty: 1 })}
                  style={{ paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderRadius:8 }}
                >
                  <Text>+1</Text>
                </Pressable>
                <Pressable
                  onPress={() => removeItem(item.variantId)}
                  style={{ paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderRadius:8 }}
                >
                  <Text>Remove</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <View style={{ marginTop: 'auto', borderTopWidth:1, borderColor:'#eee', paddingTop:12 }}>
        <Text style={{ fontSize:16, fontWeight:'700' }}>Subtotal: {formatPrice(subtotal)}</Text>
        <Text style={{ marginTop:4, color:'#666' }}>Delivery fee: ₹0</Text>
        <Pressable
          disabled={items.length === 0 || placing}
          onPress={checkoutCOD}
          style={{ opacity: (items.length === 0 || placing) ? 0.5 : 1, marginTop:12, padding:14, borderRadius:12, borderWidth:1, alignItems:'center' }}
        >
          <Text style={{ fontWeight:'700' }}>{placing ? 'Placing order…' : 'Proceed to Checkout'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* ---------- Profile (set display name + sign out) ---------- */
function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setEmail(user?.email || '');
    if (user?.id) {
      const { data, error } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();
      if (!error && data) setName(data.name || '');
    }
    setLoading(false);
  })(); }, []);

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) { setSaving(false); return; }
    const { error } = await supabase.from('profiles').update({ name }).eq('id', user.id);
    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Saved', 'Profile updated');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop:12 }}>Loading profile…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'700', marginBottom:12 }}>Profile</Text>
      <Text style={{ color:'#666', marginBottom:8 }}>Signed in as {email || '—'}</Text>
      <Text style={{ marginBottom:8 }}>Display name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:12, marginBottom:12 }}
      />
      <Button title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
      <Pressable onPress={signOut} style={{ marginTop:24 }}>
        <Text style={{ color:'#d00', fontWeight:'700' }}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

/* ---------- App (gate by session) ---------- */
export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setChecking(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription?.unsubscribe?.();
  }, []);

  if (checking) {
    return (
      <SafeAreaView style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Checking session…</Text>
      </SafeAreaView>
    );
  }
  if (!session) return <AuthScreen />;

  return (
    <CartProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Categories"
            component={CategoriesScreen}
            options={({ navigation }) => ({ headerRight: () => <HeaderActions navigation={navigation} /> })}
          />
          <Stack.Screen
            name="Products"
            component={ProductsScreen}
            options={({ route, navigation }) => ({
              title: route.params?.categoryName || 'Products',
              headerRight: () => <HeaderActions navigation={navigation} />
            })}
          />
          <Stack.Screen name="Cart" component={CartScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Address" component={AddressScreen} options={{ title: 'Addresses' }} />
          <Stack.Screen name="MyOrders" component={MyOrdersScreen} options={{ title: 'My Orders' }} />
          <Stack.Screen name="AdminHome" component={AdminHomeScreen} options={{ title: 'Admin' }} />
          <Stack.Screen name="AdminCategories" component={AdminCategoriesScreen} options={{ title: 'Category Manager' }} />
          <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'Users' }} />

        </Stack.Navigator>
      </NavigationContainer>
    </CartProvider>
  );
}
