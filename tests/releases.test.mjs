import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRelease, isHttpsUrl, needsUpdate, parseRelease } from '../src/lib/releases.ts';

const row = { platform: 'android', revision: 2, version: '1.0.1', notes: '수정', download_url: 'https://example.com/app.apk' };

test('only newer build revisions trigger updates', () => {
  assert.equal(needsUpdate(1, row), true);
  assert.equal(needsUpdate(2, row), false);
  assert.equal(needsUpdate(3, row), false);
  assert.equal(needsUpdate(1, null), false);
});

test('reject unsafe links, wrong platforms and malformed release data', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:secret@example.com', null]) assert.equal(isHttpsUrl(url), false);
  assert.deepEqual(parseRelease(row, 'android'), row);
  for (const value of [null, { ...row, revision: '2' }, { ...row, revision: 0 }, { ...row, revision: 2.5 }, { ...row, download_url: null }, { ...row, download_url: 'javascript:alert(1)' }]) {
    assert.throws(() => parseRelease(value, 'android'));
  }
  assert.throws(() => parseRelease(row, 'web'));
  assert.equal(parseRelease({ ...row, platform: 'web', download_url: null }, 'web').download_url, null);
});

test('REST reads only selected platform and activated metadata, errors never mean latest', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    const target = new URL(url);
    assert.equal(target.pathname, '/rest/v1/app_releases');
    assert.equal(target.searchParams.get('platform'), 'eq.android');
    assert.equal(target.searchParams.get('enabled'), 'eq.true');
    assert.equal(options.headers.apikey, 'test-public-key');
    assert.equal(options.cache, 'no-store');
    return Response.json([row]);
  });
  assert.deepEqual(await fetchRelease('https://test.supabase.co', 'test-public-key', 'android'), row);
  mock.mock.mockImplementation(async () => Response.json([]));
  assert.equal(await fetchRelease('https://test.supabase.co', 'test-public-key', 'android'), null);
  mock.mock.mockImplementation(async () => Response.json({ message: 'missing table' }, { status: 404 }));
  await assert.rejects(fetchRelease('https://test.supabase.co', 'test-public-key', 'android'), /HTTP 404/);
  mock.mock.mockImplementation(async () => Response.json([row, row]));
  await assert.rejects(fetchRelease('https://test.supabase.co', 'test-public-key', 'android'));
  await assert.rejects(fetchRelease(undefined, undefined, 'android'));
});
