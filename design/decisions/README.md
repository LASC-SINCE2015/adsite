# 設計判断の記録 (decisions)

設計で迷ったことと、そう決めた理由を ADR（Architecture Decision Record）として残す。あとから「なぜこうなっているのか」を確認できるようにするため。

## 書き方

- ファイル名: `NNNN_<内容がわかる英語名>.md`（NNNN は 4 桁の通し番号）。
- 項目: 状態（採用 / 置き換え済み など）・日付・状況・決定・理由・影響。
- 決定を変えるときは、元の ADR を書き換えずに新しい ADR を作り、元の ADR の状態を「置き換え済み（NNNN）」にする。

## 一覧

| No | 内容 | 状態 |
|---|---|---|
| [0001](0001_cloudflare_pages_free.md) | Cloudflare Pages の無料プランで公開し、GitHub 連携で自動公開する | 採用 |
| [0002](0002_static_html_no_build.md) | 初期はビルドなしの静的 HTML / CSS / JS で作る | 採用 |
| [0003](0003_cloudflare_web_analytics.md) | アクセス解析は Cloudflare Web Analytics を使い、Pages のダッシュボードで有効にする | 採用 |
