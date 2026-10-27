import { BackHandler, Platform, View } from 'react-native';
import { router, Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BottomTabs } from './BottomTabs';
import { TAB_ANIMATION } from './tab-animation';
import { useAndroidBack } from './useAndroidBack';
import { colors, layout } from '../../design/theme';

const labels: Record<string, string> = { index: '홈', records: '기록', friends: '친구', leave: '연차', profile: '나' };

export function MainTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const current = state.routes[state.index].name;
  useAndroidBack(() => {
    // LeaveScreen handles its calendar and dialogs before returning home.
    if (current === 'leave') return false;
    if (current === 'index') BackHandler.exitApp();
    else router.navigate('/');
    return true;
  });
  return <View style={{ alignItems: 'center', backgroundColor: colors.canvas }}><View style={{ width: '100%', maxWidth: layout.maxWidth }}>
    <BottomTabs selected={labels[current]} onSelect={label => {
      const route = state.routes.find(item => labels[item.name] === label);
      if (!route || route.name === current) return;
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!event.defaultPrevented) navigateToTab(route.key);
    }} />
  </View></View>;
}

export function MainTabs() {
  const { distance, durationMs, fade } = TAB_ANIMATION;
  return <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.canvas }}><View style={{ flex: 1, width: '100%', maxWidth: layout.maxWidth, overflow: 'hidden' }}><Tabs backBehavior={Platform.OS === 'web' ? 'fullHistory' : 'firstRoute'} tabBar={props => <MainTabBar {...props} />}
    screenOptions={{ headerShown: false, lazy: true, animation: 'shift', transitionSpec: { animation: 'timing', config: { duration: durationMs } },
      sceneStyleInterpolator: ({ current }) => ({ sceneStyle: { opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: fade ? [0, 1, 0] : [1, 1, 1] }), transform: [{ translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-distance, 0, distance] }) }] } }), sceneStyle: { backgroundColor: colors.background } }}>
    <Tabs.Screen name="index" options={{ title: '홈' }} />
    <Tabs.Screen name="records" options={{ title: '기록' }} />
    <Tabs.Screen name="friends" options={{ title: '친구' }} />
    <Tabs.Screen name="leave" options={{ title: '연차' }} />
    <Tabs.Screen name="profile" options={{ title: '나' }} />
  </Tabs></View></View>;
}
