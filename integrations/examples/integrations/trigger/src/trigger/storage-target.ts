import { randomUUID } from 'node:crypto';

export function storageTarget(prefix: string) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error('Configure S3_BUCKET with the destination bucket name');
  }
  let base: URL;
  try { base = new URL(process.env.S3_PUBLIC_BASE_URL ?? ''); }
  catch { throw new Error('Configure S3_PUBLIC_BASE_URL with the public HTTPS download base'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash ||
      base.hostname.endsWith('.r2.cloudflarestorage.com')) {
    throw new Error('S3_PUBLIC_BASE_URL must be a public HTTPS download base without credentials, query or fragment');
  }
  if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(prefix)) throw new Error('Invalid object prefix');
  const directory = `${prefix}/${randomUUID()}`;
  return {
    bucket,
    file(filename: string) {
      if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(filename)) throw new Error('Invalid output filename');
      const key = `${directory}/${filename}`;
      const encoded = key.split('/').map(encodeURIComponent).join('/');
      return { key, url: `${base.href.replace(/\/$/, '')}/${encoded}` };
    },
  };
}
