export type ReleasePlatform = 'android' | 'web';

export type AppRelease = {
  platform: ReleasePlatform;
  revision: number;
  version: string;
  notes: string;
  download_url: string | null;
};

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function parseRelease(value: unknown, platform: ReleasePlatform): AppRelease {
  if (!value || typeof value !== 'object') throw new Error('업데이트 정보 형식이 올바르지 않습니다.');
  const row = value as Record<string, unknown>;
  if (
    row.platform !== platform ||
    !Number.isSafeInteger(row.revision) || (row.revision as number) < 1 ||
    typeof row.version !== 'string' || !row.version.trim() ||
    typeof row.notes !== 'string' ||
    (row.download_url !== null && !isHttpsUrl(row.download_url)) ||
    (platform === 'android' && !isHttpsUrl(row.download_url))
  ) throw new Error('업데이트 정보 형식이 올바르지 않습니다.');
  return {
    platform, revision: row.revision as number, version: row.version,
    notes: row.notes, download_url: row.download_url as string | null,
  };
}

export function needsUpdate(currentRevision: number, release: AppRelease | null): boolean {
  return release !== null && release.revision > currentRevision;
}

export async function fetchRelease(
  projectUrl: string | undefined,
  publishableKey: string | undefined,
  platform: ReleasePlatform,
  signal?: AbortSignal,
): Promise<AppRelease | null> {
  if (!projectUrl || !publishableKey || !isHttpsUrl(projectUrl)) {
    throw new Error('Supabase 연결 설정이 필요합니다.');
  }
  const url = new URL('/rest/v1/app_releases', projectUrl);
  url.searchParams.set('select', 'platform,revision,version,notes,download_url');
  url.searchParams.set('platform', `eq.${platform}`);
  url.searchParams.set('enabled', 'eq.true');
  const response = await fetch(url.toString(), {
    headers: { apikey: publishableKey },
    cache: 'no-store', signal,
  });
  if (!response.ok) throw new Error(`업데이트 확인 실패 (HTTP ${response.status})`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length > 1) throw new Error('업데이트 정보 형식이 올바르지 않습니다.');
  return rows.length === 0 ? null : parseRelease(rows[0], platform);
}
