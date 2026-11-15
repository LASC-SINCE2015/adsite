// 作品の「いいね」の数を読み書きする API（Cloudflare Pages Functions）。
//
//   GET  /api/likes                     … すべての作品のいいね数 { "<作品の id>": 数, ... }
//   POST /api/likes  { id, delta }       … 作品のいいね数を 1 増やす（delta: 1）か 1 減らす（delta: -1）。{ id, count } を返す
//
// 数は Cloudflare D1 に保存する。Pages のプロジェクトに、変数名 LIKES_DB で D1 データベースを結び付けておく。
// テーブルは最初のアクセスで自動で作る。閲覧者の情報（IP アドレスなど）は保存しない。

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS likes (
  work_id TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
)`;

// 作品の id の一覧（site/data/works.json）を覚えておく時間
const WORK_IDS_TTL_MS = 5 * 60 * 1000;

let tableReady = null;
let workIdsCache = { ids: null, loadedAt: 0 };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function ensureTable(db) {
  if (!tableReady) {
    tableReady = db.prepare(CREATE_TABLE).run().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

// works.json に載っている作品の id だけを受け付ける（でたらめな id で表が増えないように）
async function loadWorkIds(env, requestUrl) {
  const now = Date.now();
  if (workIdsCache.ids && now - workIdsCache.loadedAt < WORK_IDS_TTL_MS) {
    return workIdsCache.ids;
  }
  const res = await env.ASSETS.fetch(new URL('/data/works.json', requestUrl));
  if (!res.ok) throw new Error(`works.json を読めませんでした（HTTP ${res.status}）`);
  const works = await res.json();
  const ids = new Set(works.map((w) => w.id));
  workIdsCache = { ids, loadedAt: now };
  return ids;
}

// 他のサイトのページから勝手に送られたリクエストを断る
function isSameOrigin(request) {
  const origin = request.headers.get('Origin');
  return origin !== null && origin === new URL(request.url).origin;
}

export async function onRequestGet({ env }) {
  if (!env.LIKES_DB) return json({ error: 'いいねの保存先が設定されていません' }, 503);
  await ensureTable(env.LIKES_DB);
  const { results } = await env.LIKES_DB.prepare('SELECT work_id, count FROM likes').all();
  const counts = {};
  for (const row of results) counts[row.work_id] = row.count;
  return json(counts);
}

export async function onRequestPost({ request, env }) {
  if (!env.LIKES_DB) return json({ error: 'いいねの保存先が設定されていません' }, 503);
  if (!isSameOrigin(request)) return json({ error: '受け付けられないリクエストです' }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON の形式が正しくありません' }, 400);
  }
  const { id, delta } = body ?? {};
  if (typeof id !== 'string' || (delta !== 1 && delta !== -1)) {
    return json({ error: 'id と delta（1 または -1）を指定してください' }, 400);
  }
  const workIds = await loadWorkIds(env, request.url);
  if (!workIds.has(id)) return json({ error: '作品が見つかりません' }, 404);

  await ensureTable(env.LIKES_DB);
  // 0 より小さくはしない
  const row = await env.LIKES_DB.prepare(
    `INSERT INTO likes (work_id, count) VALUES (?1, MAX(?2, 0))
     ON CONFLICT(work_id) DO UPDATE SET count = MAX(count + ?2, 0)
     RETURNING count`,
  )
    .bind(id, delta)
    .first();
  return json({ id, count: row.count });
}
