import {
  json,
  methodNotAllowed,
  readBody,
  requireOwner,
  sql,
  type ServerReq,
  type ServerRes,
} from '../_lib/db.js';

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'cat';

export default async function handler(req: ServerReq, res: ServerRes): Promise<void> {
  const owner = await requireOwner(req);
  if (!owner) return json(res, 401, { error: 'Not logged in.' });

  if (req.method === 'GET') {
    const rows = (await sql()`select id, label from categories order by position, label`) as {
      id: string;
      label: string;
    }[];
    return json(res, 200, { categories: rows });
  }

  if (req.method === 'POST') {
    const { label } = await readBody<{ label?: unknown }>(req);
    if (typeof label !== 'string' || !label.trim()) return json(res, 400, { error: 'Label required.' });
    const id = slug(label);
    const top = (await sql()`select coalesce(max(position), 0) as m from categories`) as { m: number }[];
    try {
      const rows = (await sql()`insert into categories (id, label, position)
        values (${id}, ${label.trim().toUpperCase()}, ${(top[0]?.m ?? 0) + 1}) returning id, label`) as {
        id: string;
        label: string;
      }[];
      return json(res, 201, { category: rows[0] });
    } catch {
      return json(res, 409, { error: 'Category already exists.' });
    }
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}
