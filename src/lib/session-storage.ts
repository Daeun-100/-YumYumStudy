import AsyncStorage from '@react-native-async-storage/async-storage';

// Native adapter; Metro resolves session-storage.web.ts for browsers.
export const sessionStorage = AsyncStorage;
