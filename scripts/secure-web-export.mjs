import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function secureWebHtml(html, projectUrl) {
  const url = new URL(projectUrl);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.username || url.password) {
    throw new Error('A valid Supabase HTTPS URL is required for the web security policy');
  }
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs, body]) => !/\bsrc\s*=/i.test(attrs) && body.trim())
    .map(([, , body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  const policy = [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "script-src-attr 'none'",
    // React Native Web inserts styles dynamically and uses inline style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${url.origin} wss://${url.hostname}`,
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  if (!/<head(?:\s[^>]*)?>/i.test(html)) throw new Error('Exported HTML has no head');
  return html.replace(/<head(?:\s[^>]*)?>/i, match => `${match}<meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer">`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.loadEnvFile?.('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const path = new URL('../dist/index.html', import.meta.url);
  const html = await readFile(path, 'utf8');
  await writeFile(path, secureWebHtml(html, process.env.EXPO_PUBLIC_SUPABASE_URL));
  console.log('Applied web content security policy to exported HTML.');
}
