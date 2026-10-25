import { StudyError } from './contracts.ts';

export function validateSupabaseConfig(url: string | undefined, key: string | undefined): { url: string; key: string } {
  if (!url || !key?.startsWith('sb_publishable_')) {
    throw new StudyError('NOT_CONFIGURED', '.env.local에 Supabase URL과 publishable key를 설정하고 개발 서버를 다시 시작해 주세요.');
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error();
  } catch {
    throw new StudyError('NOT_CONFIGURED', 'Supabase 프로젝트 URL 형식을 확인해 주세요.');
  }
  return { url, key };
}
