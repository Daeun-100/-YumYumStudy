import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { createSecureSessionStorage } from './secure-session-core';

// Native adapter; Metro resolves session-storage.web.ts for browsers.
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
export const sessionStorage = createSecureSessionStorage(AsyncStorage, {
  getItem: key => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  removeItem: key => SecureStore.deleteItemAsync(key, options),
}, randomUUID);
