import { colors, layout, spacing, typography } from '../design/theme';
import { Button, Card } from '../design/components';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import config from '../../app.json';
import { fetchRelease, needsUpdate } from '../lib/releases';
import { isTestBuild } from '../lib/room';
import type { AppRelease, ReleasePlatform } from '../lib/releases';

const currentRevision = config.expo.android.versionCode;

type UpdateState = { release: AppRelease | null; error: string | null; dismissed: number | null; retry(): void; dismiss(): void; update(): Promise<void> };
const UpdateContext = createContext<UpdateState | null>(null);

export function UpdateProvider({ children }: PropsWithChildren) {
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (isTestBuild || (Platform.OS !== 'web' && Platform.OS !== 'android')) return;
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
    const onVisibility = () => { void check(); };
    const subscription = platform === 'android'
      ? AppState.addEventListener('change', (state) => { if (state === 'active') void check(); })
      : null;
    if (platform === 'web') document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      request?.abort();
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

  return <UpdateContext.Provider value={{ release, error, dismissed, retry: () => setRetry(value => value + 1), dismiss: () => setDismissed(release?.revision ?? null), update }}>{children}</UpdateContext.Provider>;
}

export function UpdateNotice({ variant = 'inline' }: { variant?: 'inline' | 'global' }) {
  const context = useContext(UpdateContext);
  const pathname = usePathname();
  if (!context) throw new Error('UpdateProvider required');
  const { release, error, dismissed, retry, dismiss, update } = context;
  if (variant === 'global' && (pathname === '/profile-info' || !release || release.revision === dismissed)) return null;
  if (!release || release.revision === dismissed) {
    return <View style={styles.version}>
      <Text style={styles.caption}>v{config.expo.version} · 빌드 {currentRevision}</Text>
      {error && <>
        <Text style={styles.caption}>{error}</Text>
        <Button label="다시 확인" variant="secondary" size="compact" onPress={retry} />
      </>}
    </View>;
  }
  const content = <Card variant="compact" style={[styles.notice, variant === 'global' && { marginTop: 0 }]} accessibilityLiveRegion="polite">
    <Text style={styles.title}>새 버전 {release.version}이 나왔어요</Text>
    {!!release.notes && <Text style={styles.body}>{release.notes}</Text>}
    <Text style={styles.body}>{Platform.OS === 'web' ? '새로고침하면 최신 웹앱을 불러옵니다.' : '새 APK를 내려받아 설치해 주세요.'}</Text>
    {error && <Text style={styles.body}>{error}</Text>}
    <Button label={Platform.OS === 'web' ? '새로고침' : '업데이트 다운로드'} onPress={() => { void update(); }} />
    <Button label="나중에" variant="secondary" onPress={dismiss} />
  </Card>;
  return variant === 'global' ? <View style={styles.global}><ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center' }}>{content}</ScrollView></View> : content;
}

const styles = StyleSheet.create({
  global: { width: '100%', maxHeight: '45%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: colors.background },
  version: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.sm },
  caption: { ...typography.caption, color: colors.secondary, textAlign: 'center' },
  notice: { marginTop: spacing.xl, backgroundColor: colors.soft, width: '100%', maxWidth: layout.contentWidth },
  title: { ...typography.title, color: colors.text },
  body: { ...typography.secondary, color: colors.text },
});
