# 開発用ツール (tools)

## ローカルでの確認

`site/` を静的ファイルとして配信すれば確認できる（`works.json` を fetch で読むため、HTML をファイルとして直接開くのではなく、ローカルのサーバー経由で開く）。

例（Node.js がある場合、リポジトリのルートで実行）:

```bash
npx --yes http-server site -p 8080 -c-1
```

## アクセス解析のデータを取り出す

[fetch_analytics.mjs](fetch_analytics.mjs) は、Cloudflare Web Analytics（[ADR 0003](../design/decisions/0003_cloudflare_web_analytics.md)）の集計データを GraphQL Analytics API から取り出し、1 日 1 ファイルの JSON に保存する。Node.js 18 以降で動き、追加のパッケージは不要。

- API トークン（権限: `Account` / `Account Analytics` / `Read` だけ）とアカウント ID を環境変数で渡す。トークンはリポジトリに入れない。
- 保存したデータもリポジトリに入れない（`--out` にはリポジトリの外のフォルダを指定する）。
- 日付は UTC で区切る。今日（UTC）の分は集計が途中なので取らない。
- Cloudflare 側のデータは古いものから見られなくなるので、定期的に取り出して残す。

| 環境変数 | 内容 |
|---|---|
| `CF_API_TOKEN` | API トークン（必須） |
| `CF_ACCOUNT_ID` | アカウント ID（必須） |
| `CF_SITE_TAG` | Web Analytics のサイトタグ（省略時はアカウント内の全サイトの合計）。`--list-sites` で調べられる |

```bash
node tools/fetch_analytics.mjs --list-sites
```

```bash
node tools/fetch_analytics.mjs --out <保存先フォルダ> --from 2026-11-01 --to 2026-11-07
```

保存される内容: 合計（ページビュー・訪問数）と、ページ・参照元・国・端末・ブラウザ・OS ごとの内訳（各上位 100 件）。ボットは除く。

## 公開

Cloudflare Pages が GitHub と連携して自動で公開する。手作業のデプロイは不要（[ADR 0001](../design/decisions/0001_cloudflare_pages_free.md)）。
