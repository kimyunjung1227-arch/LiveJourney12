import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/styles';
import { getTimeAgo } from '../utils/timeUtils';
import { useAuth } from '../contexts/AuthContext';
import {
  getNotificationsForCurrentUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../utils/notifications';

const formatWhen = (n) => {
  if (n?.timestamp) return getTimeAgo(n.timestamp);
  return n?.time || '방금';
};

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    const list = await getNotificationsForCurrentUser(user?.id);
    setItems(list);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onOpen = async (n) => {
    if (!n.read) await markNotificationAsRead(n.id);
    await load();
    if (n.link === 'BadgeList') navigation.navigate('BadgeList');
  };

  const onDelete = async (id, e) => {
    e?.stopPropagation?.();
    await deleteNotification(id);
    await load();
  };

  const renderItem = ({ item: n }) => (
    <TouchableOpacity
      style={[styles.row, !n.read && styles.rowUnread]}
      onPress={() => onOpen(n)}
      activeOpacity={0.85}
    >
      <View style={[styles.iconCircle, { backgroundColor: '#e0f7fa' }]}>
        <MaterialIcons name="notifications" size={22} color={COLORS.primary} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {n.title}
        </Text>
        <Text style={styles.msg} numberOfLines={2}>
          {n.message}
        </Text>
        <Text style={styles.when}>{formatWhen(n)}</Text>
      </View>
      <TouchableOpacity style={styles.closeBtn} onPress={(e) => onDelete(n.id, e)} hitSlop={12}>
        <Ionicons name="close" size={22} color="#94a3b8" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>알림</Text>
        <TouchableOpacity onPress={() => markAllNotificationsAsRead().then(load)}>
          <Text style={styles.markAll}>모두 읽음</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>알림이 없습니다</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  back: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  markAll: { fontSize: 13, fontWeight: '600', color: COLORS.primary, padding: 8 },
  list: { paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rowUnread: { backgroundColor: 'rgba(0,188,212,0.06)' },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { flex: 1, marginLeft: 12, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  msg: { fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 18 },
  when: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
  },
  closeBtn: { padding: 4, marginLeft: 4 },
  empty: { paddingTop: 48, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14 },
});

export default NotificationsScreen;
