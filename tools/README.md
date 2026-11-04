# 開発用ツール (tools)

## ローカルでの確認

`site/` を静的ファイルとして配信すれば確認できる（`works.json` を fetch で読むため、HTML をファイルとして直接開くのではなく、ローカルのサーバー経由で開く）。

例（Node.js がある場合、リポジトリのルートで実行）:

```bash
npx --yes http-server site -p 8080 -c-1
```

## 公開

Cloudflare Pages が GitHub と連携して自動で公開する。手作業のデプロイは不要（[ADR 0001](../design/decisions/0001_cloudflare_pages_free.md)）。
