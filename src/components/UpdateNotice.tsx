import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import config from '../../app.json';
import { fetchRelease, needsUpdate } from '../lib/releases';
import type { AppRelease, ReleasePlatform } from '../lib/releases';

const currentRevision = config.expo.android.versionCode;

export function UpdateNotice() {
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' && Platform.OS !== 'android') return;
    const platform: ReleasePlatform = Platform.OS;
    let disposed = false;
    let request: AbortController | null = null;
    const isActive = () => platform === 'web'
      ? document.visibilityState === 'visible'
      : AppState.currentState === 'active' || AppState.currentState === null;

    async function check() {
      if (disposed || request || !isActive()) return;
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const latest = await fetchRelease(
          process.env.EXPO_PUBLIC_SUPABASE_URL,
          process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          platform, controller.signal,
        );
        if (!disposed) {
          setRelease(needsUpdate(currentRevision, latest) ? latest : null);
          setError(null);
        }
      } catch (failure) {
        if (!disposed) setError(failure instanceof Error ? failure.message : '업데이트를 확인하지 못했습니다.');
      } finally {
        clearTimeout(timeout);
        request = null;
      }
    }

    void check();
    const interval = setInterval(() => { void check(); }, 60000);
    const onVisibility = () => { void check(); };
    const subscription = platform === 'android'
      ? AppState.addEventListener('change', (state) => { if (state === 'active') void check(); })
      : null;
    if (platform === 'web') document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      request?.abort();
      clearInterval(interval);
      subscription?.remove();
      if (platform === 'web') document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [retry]);

  async function update() {
    if (!release) return;
    try {
      if (Platform.OS === 'web') {
        // A fresh navigation fetches the newly deployed web app; no service worker is used.
        const destination = new URL(window.location.href);
        destination.searchParams.set('_release', String(release.revision));
        window.location.assign(destination.toString());
      } else if (release.download_url) {
        await Linking.openURL(release.download_url);
      }
    } catch {
      setError('업데이트 주소를 열지 못했습니다. 다시 시도해 주세요.');
    }
  }

  if (!release || release.revision === dismissed) {
    return <View style={styles.version}>
      <Text style={styles.caption}>v{config.expo.version} · 빌드 {currentRevision}</Text>
      {error && <>
        <Text style={styles.caption}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => setRetry((value) => value + 1)}><Text style={styles.link}>다시 확인</Text></Pressable>
      </>}
    </View>;
  }
  return <View style={styles.notice} accessibilityLiveRegion="polite">
    <Text style={styles.title}>새 버전 {release.version}이 나왔어요</Text>
    {!!release.notes && <Text style={styles.body}>{release.notes}</Text>}
    <Text style={styles.body}>{Platform.OS === 'web' ? '새로고침하면 최신 웹앱을 불러옵니다.' : '새 APK를 내려받아 설치해 주세요.'}</Text>
    {error && <Text style={styles.body}>{error}</Text>}
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => { void update(); }}>
      <Text style={styles.buttonText}>{Platform.OS === 'web' ? '새로고침' : '업데이트 다운로드'}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => setDismissed(release.revision)}><Text style={styles.link}>나중에</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  version: { alignItems: 'center', marginTop: 20, gap: 8 },
  caption: { color: '#52635A', fontSize: 12, textAlign: 'center' },
  notice: { marginTop: 20, padding: 20, borderRadius: 16, backgroundColor: '#E0EEDF', width: '100%', maxWidth: 480, gap: 12 },
  title: { color: '#182D22', fontSize: 18, fontWeight: '700' },
  body: { color: '#344A3C', fontSize: 14, lineHeight: 22 },
  button: { backgroundColor: '#426447', padding: 12, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '600' },
  link: { color: '#305E3C', padding: 8, textAlign: 'center', textDecorationLine: 'underline' },
});
