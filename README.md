# adsite

自作の Web アプリ・Web アプリゲームを紹介・誘導するポータルサイト（ポートフォリオ兼まとめサイト）です。各作品は個別に動かし、このサイトからはリンクで案内します。Cloudflare Pages（無料）で公開します。

## フォルダ構成

| フォルダ | 内容 |
|---|---|
| [spec/](spec/README.md) | 仕様書（何を作るか） |
| [design/](design/README.md) | 設計書（どう作るか）・設計判断の記録（ADR） |
| [testing/](testing/README.md) | 確認内容（テスト計画）と確認結果 |
| [site/](site/) | 公開するサイト本体（Cloudflare Pages の出力ディレクトリ） |
| [tools/](tools/README.md) | 開発用スクリプト・ローカルでの確認方法 |

## 公開

`master` に push（マージ）すると本番に、それ以外のブランチ（`develop` や機能ブランチ）に push するとプレビュー用の URL に、Cloudflare Pages が自動で公開します（[design/decisions/0001](design/decisions/0001_cloudflare_pages_free.md)）。
