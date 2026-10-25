import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { useIdentity } from '../components/IdentityProvider';

// Temporary core verification screen; 02 replaces this with TodayScreen.
export default function Home() {
  const { loading, uid, profile, error, retry } = useIdentity();
  return <Screen>
    <Text style={styles.eyebrow}>YUMYUM STUDY</Text>
    <Text accessibilityRole="header" style={styles.title}>함께 쌓는 공부 시간</Text>
    <Text style={styles.body}>로그인 없이 시작하고, 이 기기의 UID로 기록을 구분해요.</Text>
    <View style={styles.card}>
      {loading && <ActivityIndicator color="#426447" accessibilityLabel="자동 연결 중" />}
      <Text style={styles.cardTitle}>{loading ? '연결 확인 중' : uid ? 'UID 연결 완료' : '연결을 확인해 주세요'}</Text>
      {uid && <>
        <Text style={styles.label}>내 UID</Text>
        <Text selectable style={styles.uid}>{uid}</Text>
      </>}
      {profile && <Text style={styles.body}>{profile.displayName}님, 스터디방에 연결됐어요.</Text>}
      {error && <Text accessibilityRole="alert" style={styles.body}>{error.message}</Text>}
      {!loading && error && <Pressable accessibilityRole="button" style={styles.button} onPress={retry}>
        <Text style={styles.buttonText}>다시 확인</Text>
      </Pressable>}
    </View>
    <Text style={styles.note}>현재는 공통 기반을 확인하는 화면이에요. 공부 타이머와 친구 현황은 아직 연결되지 않았어요.</Text>
    <Text style={styles.note}>브라우저 저장소나 앱 데이터를 지우면 기존 UID를 이어 쓰기 어려워요.</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: '#426447', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: '#182D22', fontSize: 28, fontWeight: '700' },
  body: { color: '#52635A', fontSize: 15, lineHeight: 25 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, gap: 14 },
  cardTitle: { color: '#182D22', fontSize: 19, fontWeight: '600' },
  label: { color: '#52635A', fontSize: 12 },
  uid: { color: '#182D22', fontSize: 13, lineHeight: 22 },
  button: { backgroundColor: '#426447', borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '600' },
  note: { color: '#52635A', fontSize: 12, lineHeight: 20 },
});
