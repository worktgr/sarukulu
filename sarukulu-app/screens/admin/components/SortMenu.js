// screens/admin/components/SortMenu.js
import { useState } from 'react';
import { Modal, View, Pressable, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);

  const Item = ({ id, label }) => (
    <Pressable
      onPress={() => { onChange(id); setOpen(false); }}
      style={{
        paddingHorizontal: 16, paddingVertical: 14,
        backgroundColor: value === id ? '#eef2ff' : '#fff',
        borderBottomWidth: 1, borderColor: '#eee'
      }}
    >
      <Text style={{ fontSize: 15 }}>{label}</Text>
    </Pressable>
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={{ padding: 8, borderWidth: 1, borderRadius: 10, backgroundColor: '#fff' }}
      >
        <MaterialIcons name="sort" size={20} />
      </Pressable>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex:1, backgroundColor:'rgba(0,0,0,0.2)' }} onPress={() => setOpen(false)}>
          <View style={{
            position: 'absolute', top: 70, right: 16, width: 220,
            backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd',
            borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 10,
            overflow: 'hidden'
          }}>
            <Item id="active" label="Active first" />
            <Item id="name" label="Name (A–Z)" />
            <Item id="custom" label="Custom order" />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
