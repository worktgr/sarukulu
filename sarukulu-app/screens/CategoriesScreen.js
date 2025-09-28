// screens/CategoriesScreen.js
import { useEffect, useState, useMemo } from 'react';
import { SafeAreaView, Text, FlatList, View, Image, ActivityIndicator, Pressable, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

export default function CategoriesScreen({ navigation }) {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, image_url')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) setErr(error.message);
      else setCats(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Loading categories…</Text>
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

  // Tile component
  const renderItem = ({ item }) => {
    const onPress = () =>
      navigation.navigate('Products', { categoryId: item.id, categoryName: item.name });

    return (
      <Pressable
        onPress={onPress}
        style={{
          flexBasis: '25%', maxWidth: '25%',
          padding: 8
        }}
      >
        <View style={{
          borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 8,
          alignItems: 'center', justifyContent: 'center'
        }}>
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: '#f5f5f5' }}
              resizeMode="cover"
            />
          ) : (
            <View style={{
              width: 72, height: 72, borderRadius: 12, backgroundColor: '#f5f5f5',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Text style={{ fontWeight: '700' }}>{item.name?.[0] || '?'}</Text>
            </View>
          )}
          <Text
            numberOfLines={2}
            style={{ textAlign: 'center', marginTop: 8, fontSize: 12, fontWeight: '600' }}
          >
            {item.name}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex:1, padding: 8 }}>
      <FlatList
        data={cats}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        numColumns={4}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
