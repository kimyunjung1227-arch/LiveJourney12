import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/styles';
import { ScreenLayout, ScreenContent, ScreenHeader, ScreenBody } from '../components/ScreenLayout';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const [activityNotification, setActivityNotification] = useState(true);
  const [locationNotification, setLocationNotification] = useState(true);

  const toggleActivityNotification = () => {
    setActivityNotification(!activityNotification);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('authToken');
      navigation.navigate('Welcome');
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  return (
    <ScreenLayout>
      {/* 헤더 - 웹과 동일한 구조 (ScreenContent 밖) */}
      <ScreenHeader>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>설정</Text>
          <View style={{width: 40}} />
        </View>
      </ScreenHeader>

      <ScreenContent>
        <ScreenBody>
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
        {/* 알림 설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>알림 설정</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>활동 알림</Text>
            <Switch
              value={activityNotification}
              onValueChange={toggleActivityNotification}
              trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
              thumbColor={COLORS.surface}
            />
          </View>

        </View>

        {/* 구분선 */}
        <View style={styles.divider} />

        {/* 계정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계정</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {/* TODO: 개인정보 편집 화면 */ }}
          >
            <Text style={styles.settingLabel}>개인정보 수정</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {/* TODO: 비밀번호 변경 */ }}
          >
            <Text style={styles.settingLabel}>비밀번호 변경</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {/* TODO: 계정 연결 관리 */ }}
          >
            <Text style={styles.settingLabel}>계정 연결 관리</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* 구분선 */}
        <View style={styles.divider} />

        {/* 고객 지원 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>고객 지원</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('Notices')}
          >
            <Text style={styles.settingLabel}>공지사항</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {/* TODO: FAQ */ }}
          >
            <Text style={styles.settingLabel}>자주 묻는 질문</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {/* TODO: 문의하기 */ }}
          >
            <Text style={styles.settingLabel}>문의하기</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* 구분선 */}
        <View style={styles.divider} />

        {/* 약관 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>약관 및 정책</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {/* TODO: 이용약관 */ }}
          >
            <Text style={styles.settingLabel}>이용약관</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {/* TODO: 개인정보처리방침 */ }}
          >
            <Text style={styles.settingLabel}>개인정보처리방침</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* 구분선 */}
        <View style={styles.divider} />

        {/* 로그아웃 */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.settingItem, styles.dangerItem]}
            onPress={handleLogout}
          >
            <Text style={styles.dangerText}>로그아웃</Text>
            <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>

        {/* 하단 여백 */}
        <View style={{height: 100}} />
          </ScrollView>
        </ScreenBody>
      </ScreenContent>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 100, // 하단 네비게이션 바(80px) + 여유 공간(20px)
  },
  section: {
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    minHeight: 56,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  divider: {
    height: 8,
    backgroundColor: COLORS.background,
  },
  dangerItem: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  dangerText: {
    fontSize: 16,
    color: COLORS.danger,
    fontWeight: '500',
  },
});

export default SettingsScreen;
