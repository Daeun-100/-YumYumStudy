import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { IdentityProvider } from '../components/IdentityProvider';
import { UpdateNotice } from '../components/UpdateNotice';

export default function RootLayout() {
  return <SafeAreaProvider>
    <IdentityProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F7F2' }}>
        <Stack screenOptions={{ headerShown: false }} />
        <View style={{ paddingHorizontal: 20, paddingBottom: 12, alignItems: 'center' }}><UpdateNotice /></View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </IdentityProvider>
  </SafeAreaProvider>;
}
