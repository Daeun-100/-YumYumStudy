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

export default function RootLayout() {
  return <SafeAreaProvider><RoomBuildBoundary><UpdateProvider><IdentityProvider><AdmissionGate><StudyProvider><LeaveProvider>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <CallNotificationLifecycle />
      <UpdateNotice variant="global" />
      <StartupBoundary><TestRoomSelector /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} /></StartupBoundary>
      <StatusBar style="dark" />
    </SafeAreaView>
  </LeaveProvider></StudyProvider></AdmissionGate></IdentityProvider></UpdateProvider></RoomBuildBoundary></SafeAreaProvider>;
}
