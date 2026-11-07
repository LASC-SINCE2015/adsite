// Cloudflare Web Analytics の集計データを GraphQL Analytics API から取り出し、1 日ごとの JSON に保存する。
//
// 使い方:
//   node tools/fetch_analytics.mjs --out <保存先フォルダ> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--force]
//   node tools/fetch_analytics.mjs --list-sites
//
// 環境変数:
//   CF_API_TOKEN   … API トークン（権限: Account / Account Analytics / Read）。必須
//   CF_ACCOUNT_ID  … Cloudflare のアカウント ID。必須
//   CF_SITE_TAG    … Web Analytics のサイトタグ。省略するとアカウント内の全サイトを合計する
//
// 日付は UTC で区切る。--from / --to を省略すると、昨日まで（UTC）の 7 日分を取る。
// 保存先に同じ日のファイルがあれば取り直さない（--force で取り直す）。
// 今日（UTC）の分は集計が途中なので取らない。

import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const API_URL = 'https://api.cloudflare.com/client/v4/graphql';
const TOP_N = 100;

// 内訳を取る項目（JSON のキー → GraphQL の dimensions のフィールド名）
const BREAKDOWNS = {
  byPath: 'requestPath',
  byReferer: 'refererHost',
  byCountry: 'countryName',
  byDevice: 'deviceType',
  byBrowser: 'userAgentBrowser',
  byOs: 'userAgentOS',
};

function parseArgs(argv) {
  const args = { force: false, listSites: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--from') args.from = argv[++i];
    else if (a === '--to') args.to = argv[++i];
    else if (a === '--force') args.force = true;
    else if (a === '--list-sites') args.listSites = true;
    else throw new Error(`不明な引数です: ${a}`);
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`環境変数 ${name} が設定されていません`);
  return v;
}

function toDateString(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return toDateString(d);
}

function checkDate(s, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) {
    throw new Error(`${label} の日付が正しくありません（YYYY-MM-DD）: ${s}`);
  }
}

async function graphql(token, query, variables) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    throw new Error(`API の呼び出しに失敗しました（HTTP ${res.status}）`);
  }
  if (body.errors && body.errors.length > 0) {
    throw new Error(`API がエラーを返しました: ${body.errors.map((e) => e.message).join(' / ')}`);
  }
  const account = body.data?.viewer?.accounts?.[0];
  if (!account) throw new Error('アカウントのデータが取れませんでした（アカウント ID とトークンの権限を確認）');
  return account;
}

function buildFilter(date, siteTag) {
  const conditions = [
    { datetime_geq: `${date}T00:00:00Z`, datetime_leq: `${date}T23:59:59Z` },
    { bot: 0 },
  ];
  if (siteTag) conditions.push({ siteTag });
  return { AND: conditions };
}

const DAY_QUERY = `
query ($accountTag: string!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      total: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 1) {
        count
        sum { visits }
      }
${Object.entries(BREAKDOWNS)
  .map(
    ([key, field]) => `      ${key}: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: ${TOP_N}, orderBy: [count_DESC]) {
        count
        sum { visits }
        dimensions { ${field} }
      }`,
  )
  .join('\n')}
    }
  }
}`;

async function fetchDay(token, accountId, siteTag, date) {
  const account = await graphql(token, DAY_QUERY, {
    accountTag: accountId,
    filter: buildFilter(date, siteTag),
  });
  const total = account.total?.[0];
  const result = {
    date,
    timezone: 'UTC',
    siteTag: siteTag || null,
    fetchedAt: new Date().toISOString(),
    total: { pageViews: total?.count ?? 0, visits: total?.sum?.visits ?? 0 },
  };
  for (const [key, field] of Object.entries(BREAKDOWNS)) {
    result[key] = (account[key] ?? []).map((g) => ({
      [field]: g.dimensions[field],
      pageViews: g.count,
      visits: g.sum.visits,
    }));
  }
  return result;
}

async function listSites(token, accountId) {
  const to = toDateString(new Date());
  const from = addDays(to, -7);
  const query = `
query ($accountTag: string!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      sites: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 100, orderBy: [count_DESC]) {
        count
        dimensions { siteTag requestHost }
      }
    }
  }
}`;
  const account = await graphql(token, query, {
    accountTag: accountId,
    filter: { AND: [{ datetime_geq: `${from}T00:00:00Z`, datetime_leq: `${to}T23:59:59Z` }] },
  });
  const sites = account.sites ?? [];
  if (sites.length === 0) {
    console.log('直近 7 日間のデータがあるサイトはありません。');
    return;
  }
  console.log('直近 7 日間のデータがあるサイト（siteTag / ホスト / ページビュー）:');
  for (const s of sites) {
    console.log(`  ${s.dimensions.siteTag}  ${s.dimensions.requestHost}  ${s.count}`);
  }
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = requireEnv('CF_API_TOKEN');
  const accountId = requireEnv('CF_ACCOUNT_ID');
  const siteTag = process.env.CF_SITE_TAG || '';

  if (args.listSites) {
    await listSites(token, accountId);
    return;
  }

  if (!args.out) throw new Error('--out で保存先フォルダを指定してください');
  const yesterday = addDays(toDateString(new Date()), -1);
  const to = args.to ?? yesterday;
  const from = args.from ?? addDays(to, -6);
  checkDate(from, '--from');
  checkDate(to, '--to');
  if (from > to) throw new Error('--from は --to 以前の日付にしてください');
  if (to > yesterday) throw new Error(`今日（UTC）以降の日付は取れません。--to は ${yesterday} 以前にしてください`);

  await mkdir(args.out, { recursive: true });
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const file = path.join(args.out, `${date}.json`);
    if (!args.force && (await exists(file))) {
      console.log(`${date}: 保存済みのため飛ばします`);
      continue;
    }
    const data = await fetchDay(token, accountId, siteTag, date);
    await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    console.log(`${date}: ページビュー ${data.total.pageViews} / 訪問 ${data.total.visits} → ${file}`);
  }
}

main().catch((err) => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});
