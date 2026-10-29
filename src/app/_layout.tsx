import { AppVersionReporter } from '../features/app-version/AppVersionReporter';
import { StartupBoundary } from '../components/StartupBoundary';
import { CallNotificationLifecycle } from '../features/call-friend/CallNotifications';
import { RoomBuildBoundary, TestRoomSelector } from '../components/RoomBuildBoundary';
import { UpdateNotice, UpdateProvider } from '../components/UpdateNotice';
import { AdmissionGate } from '../components/AdmissionGate';
import { LeaveProvider } from '../features/leave/LeaveProvider';
import { colors } from '../design/theme';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { IdentityProvider } from '../components/IdentityProvider';
import { StudyProvider } from '../features/study/StudyProvider';
import { AppToastProvider } from '../components/AppToastProvider';
import { AchievementCelebrations } from '../features/celebrations/AchievementCelebrations';

export default function RootLayout() {
  return <SafeAreaProvider><RoomBuildBoundary><UpdateProvider><IdentityProvider><AdmissionGate><StudyProvider><LeaveProvider>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <AppVersionReporter />
      <CallNotificationLifecycle />
      <UpdateNotice variant="global" />
      <StartupBoundary><AppToastProvider><TestRoomSelector /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
      </Stack><AchievementCelebrations /></AppToastProvider></StartupBoundary>
      <StatusBar style="dark" />
    </SafeAreaView>
  </LeaveProvider></StudyProvider></AdmissionGate></IdentityProvider></UpdateProvider></RoomBuildBoundary></SafeAreaProvider>;
}
