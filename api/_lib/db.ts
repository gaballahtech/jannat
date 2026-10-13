import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

const scrypt = promisify(_scrypt);

let _sql: NeonQueryFunction<false, false> | null = null;

/** Neon HTTP client (pooled). Requires DATABASE_URL. */
export function sql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  _sql = neon(url);
  return _sql;
}

export type ApiError = { error: string };

export function json(res: ServerRes, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

// Minimal Vercel req/res shapes (no @vercel/node dependency needed).
export type ServerReq = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};
export type ServerRes = {
  statusCode: number;
  setHeader: (name: string, value: string | string[]) => void;
  end: (body?: string) => void;
};

export function methodNotAllowed(res: ServerRes, allow: string[]): void {
  res.setHeader('Allow', allow.join(', '));
  json(res, 405, { error: `Use ${allow.join(' or ')}` });
}

export async function readBody<T = Record<string, unknown>>(req: ServerReq): Promise<T> {
  if (req.body && typeof req.body === 'object') return req.body as T;
  if (typeof req.body === 'string' && req.body.length > 0) {
    try {
      return JSON.parse(req.body) as T;
    } catch {
      return {} as T;
    }
  }
  return {} as T;
}

/* ---------- password hashing (scrypt, no native deps) ---------- */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split(':');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/* ---------- sessions (opaque token + httpOnly cookie) ---------- */

const COOKIE = 'pearlin_sid';
const SESSION_DAYS = 30;

export function newToken(): string {
  return randomBytes(32).toString('hex');
}

function isProd(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

export function sessionCookie(token: string, maxAgeSec: number): string {
  const parts = [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (isProd()) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(): string {
  const parts = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isProd()) parts.push('Secure');
  return parts.join('; ');
}

function cookieHeader(req: ServerReq): string {
  const h = req.headers.cookie;
  return Array.isArray(h) ? h.join('; ') : (h ?? '');
}

export function sessionTokenFrom(req: ServerReq): string | null {
  for (const part of cookieHeader(req).split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === COOKIE) return rest.join('=') || null;
  }
  return null;
}

export type Owner = { id: string; email: string };

export async function createSession(ownerId: string): Promise<{ token: string; maxAge: number }> {
  const token = newToken();
  const maxAge = SESSION_DAYS * 24 * 3600;
  await sql()`insert into sessions (token, owner_id, expires_at)
    values (${token}, ${ownerId}, now() + (${maxAge} || ' seconds')::interval)`;
  return { token, maxAge };
}

/** Returns the logged-in owner, or null. Cleans up expired sessions lazily. */
export async function requireOwner(req: ServerReq): Promise<Owner | null> {
  const token = sessionTokenFrom(req);
  if (!token) return null;
  const rows = await sql()`select o.id, o.email from sessions s
    join owners o on o.id = s.owner_id
    where s.token = ${token} and s.expires_at > now() limit 1`;
  if (rows.length === 0) {
    await sql()`delete from sessions where token = ${token}`;
    return null;
  }
  return rows[0] as Owner;
}

export async function destroySession(req: ServerReq): Promise<void> {
  const token = sessionTokenFrom(req);
  if (token) await sql()`delete from sessions where token = ${token}`;
}
