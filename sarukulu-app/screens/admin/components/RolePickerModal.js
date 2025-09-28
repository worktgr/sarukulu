// screens/admin/components/RolePickerModal.js
import { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable } from 'react-native';

const ROLES = ['admin', 'manager', 'delivery'];

export default function RolePickerModal({ visible, value, onClose, onConfirm }) {
  const [sel, setSel] = useState(value || 'manager');

  useEffect(() => { if (visible) setSel(value || 'manager'); }, [visible, value]);

  const Item = ({ r }) => (
    <Pressable
      onPress={() => setSel(r)}
      style={{
        paddingHorizontal: 16, paddingVertical: 14,
        backgroundColor: sel === r ? '#eef2ff' : '#fff',
        borderBottomWidth: 1, borderColor: '#eee'
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: sel === r ? '700' : '400' }}>{r}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={{ flex:1, backgroundColor:'rgba(0,0,0,0.2)' }} onPress={onClose}>
        <View style={{
          position:'absolute', top: 120, right: 16, left: 16,
          backgroundColor:'#fff', borderWidth:1, borderColor:'#ddd',
          borderRadius:12, overflow:'hidden'
        }}>
          {ROLES.map(r => <Item key={r} r={r} />)}
          <View style={{ flexDirection:'row', justifyContent:'flex-end', gap:10, padding:12 }}>
            <Pressable onPress={onClose} style={{ borderWidth:1, borderRadius:8, paddingHorizontal:12, paddingVertical:8 }}>
              <Text>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm?.(sel)}
              style={{ borderWidth:1, borderRadius:8, paddingHorizontal:12, paddingVertical:8, backgroundColor:'#eef7ff' }}
            >
              <Text style={{ fontWeight:'700' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
