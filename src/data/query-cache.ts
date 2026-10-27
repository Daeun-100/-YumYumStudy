import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMemoryCache } from '../lib/memory-cache';
import { createRecordHistoryCache } from '../lib/record-history-cache';
import { withTimeout } from '../lib/with-timeout';

const project = encodeURIComponent(process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'unconfigured');
const records = createRecordHistoryCache({
  getItem: key => withTimeout(AsyncStorage.getItem(`${key}.${project}`), 2000, '기록 캐시 읽기 지연'),
  setItem: (key, value) => withTimeout(AsyncStorage.setItem(`${key}.${project}`, value), 2000, '기록 캐시 쓰기 지연'),
});
export const memoryCache = createMemoryCache(80, records);
