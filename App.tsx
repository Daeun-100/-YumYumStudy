import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { UpdateNotice } from './src/components/UpdateNotice';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>YUMYUM STUDY</Text>
      <Text accessibilityRole="header" style={styles.title}>함께 쌓는 공부 시간</Text>
      <Text style={styles.description}>4명의 목표와 기록을 한곳에서.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>개발 준비가 완료됐어요</Text>
        <Text style={styles.description}>자동 UID 발급과 공부 타이머는 다음 단계에서 연결합니다.</Text>
        <Text style={styles.note}>{Platform.OS === 'web' ? 'iPhone은 웹앱으로 사용합니다.' : 'Android는 APK로 배포합니다.'}</Text>
      </View>
      <UpdateNotice />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F2',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { color: '#426447', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: '#182D22', fontSize: 28, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  description: { color: '#52635A', fontSize: 16, lineHeight: 26, marginTop: 12, textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 28, marginTop: 32, maxWidth: 480, width: '100%' },
  cardTitle: { color: '#182D22', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  note: { color: '#52635A', fontSize: 13, marginTop: 20, textAlign: 'center' },
});
