import { StudyError } from './contracts';

// Do not silently fall back to memory: that would create new UIDs after reload.
function storage(): Storage {
  if (typeof window === 'undefined') throw new StudyError('NOT_CONFIGURED', '브라우저에서 앱을 열어 주세요.');
  return window.localStorage;
}

export const sessionStorage = {
  getItem(key: string): string | null { return storage().getItem(key); },
  setItem(key: string, value: string): void { storage().setItem(key, value); },
  removeItem(key: string): void { storage().removeItem(key); },
};
