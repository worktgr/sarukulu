// screens/admin/components/AdminCategoryCard.js
import { View, Text, Image, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function AdminCategoryCard({
  item,
  onEdit,
  onToggleActive,
  onDelete,
  onDragHandleLongPress
}) {
  return (
    <View
      style={{
        borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, marginBottom: 12,
        backgroundColor: '#fff'
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* Drag handle */}
        <Pressable onLongPress={onDragHandleLongPress} hitSlop={8} style={{ padding: 4 }}>
          <MaterialIcons name="drag-indicator" size={22} color="#555" />
        </Pressable>

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
            {/* products badge */}
            <View style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 12, color: '#666' }}>{item.product_count} product(s)</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable onPress={onEdit} hitSlop={8} style={{ padding: 6, borderWidth: 1, borderRadius: 8 }}>
            <MaterialIcons name="edit" size={18} />
          </Pressable>

          <Pressable onPress={onToggleActive} hitSlop={8} style={{ padding: 6, borderWidth: 1, borderRadius: 8 }}>
            <MaterialIcons name={item.is_active ? 'visibility' : 'visibility-off'} size={18} />
          </Pressable>

          <Pressable
            onPress={onDelete}
            disabled={(item.product_count || 0) > 0}
            hitSlop={8}
            style={{
              padding: 6, borderWidth: 1, borderRadius: 8,
              opacity: (item.product_count || 0) > 0 ? 0.5 : 1
            }}
          >
            <MaterialIcons name="delete" size={18} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
