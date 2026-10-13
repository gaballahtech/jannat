import {
  json,
  methodNotAllowed,
  readBody,
  requireOwner,
  sql,
  type ServerReq,
  type ServerRes,
} from '../_lib/db.js';

/* Generic key/value shop settings: biz, home (hero), … */
export default async function handler(req: ServerReq, res: ServerRes): Promise<void> {
  const owner = await requireOwner(req);
  if (!owner) return json(res, 401, { error: 'Not logged in.' });

  if (req.method === 'GET') {
    const rows = (await sql()`select key, value from settings`) as { key: string; value: unknown }[];
    const out: Record<string, unknown> = {};
    for (const r of rows) out[r.key] = r.value;
    return json(res, 200, { settings: out });
  }

  if (req.method === 'PUT') {
    const { key, value } = await readBody<{ key?: unknown; value?: unknown }>(req);
    if (typeof key !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(key) || value === undefined) {
      return json(res, 400, { error: 'key + value required.' });
    }
    await sql()`insert into settings (key, value, updated_at) values (${key}, ${JSON.stringify(value)}::jsonb, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()`;
    return json(res, 200, { ok: true });
  }

  return methodNotAllowed(res, ['GET', 'PUT']);
}
