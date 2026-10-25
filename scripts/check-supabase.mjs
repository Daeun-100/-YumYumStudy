// Run: node --env-file=.env.local scripts/check-supabase.mjs [--anonymous]
// --anonymous creates one test user. Tokens stay in memory and are never logged.
const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

async function check() {
  if (!projectUrl || !publishableKey?.startsWith('sb_publishable_')) {
    throw new Error('Supabase URL 또는 publishable key 설정을 확인하세요.');
  }
  const base = new URL(projectUrl);
  if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co')) {
    throw new Error('Supabase HTTPS 프로젝트 주소가 필요합니다.');
  }
  async function request(path, options = {}) {
    const response = await fetch(new URL(path, base), {
      ...options,
      headers: { apikey: publishableKey, ...options.headers },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    const data = await response.json();
    if (!response.ok) {
      // Do not print the response body: it may contain credentials.
      const code = typeof data.error_code === 'string' ? data.error_code : 'unknown';
      throw new Error(`Supabase 응답 오류: HTTP ${response.status}, code=${code}`);
    }
    return data;
  }
  const settings = await request('/auth/v1/settings');
  console.log('PASS: 프로젝트 주소 및 공개 키로 Auth API 연결');
  console.log(`익명 인증 설정: ${settings.external?.anonymous === true ? '활성' : '설정 응답에서 확인되지 않음'}`);
  if (!process.argv.includes('--anonymous')) return;

  const session = await request('/auth/v1/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { connection_test: true } }),
  });
  if (!session.access_token || !session.user?.id || session.user.is_anonymous !== true) {
    throw new Error('익명 UID 또는 인증 세션 발급 결과를 확인할 수 없습니다.');
  }
  console.log('PASS: 익명 UID 및 인증 세션 발급');
  const user = await request('/auth/v1/user', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (user.id !== session.user.id || user.is_anonymous !== true) {
    throw new Error('서버 사용자 검증 결과가 발급된 UID와 다릅니다.');
  }
  console.log('PASS: 발급 세션으로 서버 사용자 재조회 및 UID 일치 확인');
  console.log(`테스트 UID: ${user.id}`);
  console.log('테스트 익명 사용자 1명이 생성되었습니다. 세션 토큰은 저장하지 않았습니다.');
}

check().catch((error) => {
  console.error(error instanceof Error ? error.message : '연결 검사 실패');
  if (error.cause?.code) console.error(`Network code: ${error.cause.code}`);
  process.exitCode = 1;
});
