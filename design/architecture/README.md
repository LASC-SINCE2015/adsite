# アーキテクチャ (architecture)

## リポジトリのフォルダ構成

```
adsite/
├─ README.md
├─ spec/                … 仕様書
├─ design/              … 設計書
│  ├─ architecture/     … このファイル
│  └─ decisions/        … 設計判断の記録（ADR）
├─ testing/             … 確認内容と確認結果
│  └─ results/          … 確認結果（<日付>_<ブランチ名>.md）
├─ tools/               … 開発用スクリプト
├─ functions/           … サーバー側の処理（Cloudflare Pages Functions。公開はされず、API として動く）
│  └─ api/
│     └─ likes.js       … いいねの数を読み書きする API（/api/likes）
└─ site/                … 公開するサイト本体（このフォルダの中身がそのまま配信される）
   ├─ index.html        … トップページ（プロフィール・作品カード一覧）
   ├─ about.html        … サイトについて（運営者・広告掲載の表記・免責事項・お問い合わせ）
   ├─ privacy.html      … プライバシーポリシー（取得する情報・Cookie・広告配信）
   ├─ 404.html          … ページが見つからないときのページ（ミニゲーム付き）
   ├─ robots.txt        … 検索エンジン向けの案内（サイトマップの場所）
   ├─ sitemap.xml       … 検索エンジンに知らせるページの一覧
   ├─ _headers          … Cloudflare Pages の応答ヘッダーの設定（プレビュー URL を検索結果に出さない）
   ├─ data/
   │  └─ works.json     … 作品の一覧（カードの元データ）
   └─ assets/
      ├─ css/
      ├─ js/
      │  ├─ main.js            … 作品カードの一覧・タグの絞り込み
      │  ├─ likes.js           … 作品カードのいいねボタン
      │  ├─ card-tilt.js       … 作品カードの 3D チルト
      │  ├─ hero-particles.js  … 見出しの粒子演出
      │  └─ game-404.js        … 404 ページのミニゲーム
      └─ images/
         ├─ ogp.png     … SNS で共有されたときの画像（1200×630。tools/make_ogp_image.ps1 で作る）
         └─ works/      … 作品のサムネイル画像（<作品の id>.png など）
```

- `site/` の外のファイル（md など）は公開されない。公開したくないものは `site/` に置かない。
- ビルドは行わない（[ADR 0002](../decisions/0002_static_html_no_build.md)）。
- `404.html` は Cloudflare Pages が、存在しない URL へのアクセスに対してステータス 404 で返す。どの階層の URL でも表示されるため、中で読み込むファイルや他ページへのリンクは `/assets/...` のようにサイトの最上位からのパスで書く。
- 動きのある仕掛けの設計は [interactions.md](interactions.md) を参照。

## 検索・SNS 向けの設定

- 各ページの `<head>` に `canonical`（正式な URL）・OGP（`og:*`）・`twitter:card`（`summary_large_image`）を書く。URL は拡張子なし（`/about` など。Cloudflare Pages が `.html` なしの URL に転送するため）。
- 共有時の画像は `assets/images/ogp.png` を全ページで使う。`og:image` は `https://` からの絶対 URL で書く。
- ページを追加・削除したら、`sitemap.xml` も直す。
- プレビュー URL（`<ブランチ名>.<プロジェクト名>.pages.dev` など）は、`_headers` で `X-Robots-Tag: noindex` を付けて検索結果に出さない。

## 作品データ（site/data/works.json）

作品を追加するときは、このファイルに 1 件足し、サムネイルを `site/assets/images/works/` に置く。

| 項目 | 型 | 内容 |
|---|---|---|
| `id` | 文字列 | 作品を表す英小文字の名前（例: `living-manager`）。サムネイルのファイル名にも使う。 |
| `title` | 文字列 | 作品名 |
| `summary` | 文字列 | 概要（カードに出す 1〜2 文） |
| `tags` | 文字列の配列 | ジャンル・技術など（例: `["ゲーム", "Flutter"]`） |
| `thumbnail` | 文字列 | サムネイルのパス（`site/` からの相対パス） |
| `url` | 文字列 | 作品本体の URL（「遊ぶ / 使ってみる」ボタンのリンク先）。制作中の作品では省略できる |
| `kind` | `"app"` / `"game"` | ボタンの文言を「使ってみる」「遊ぶ」で切り替える |
| `guide` | オブジェクト（省略可） | 導入手順へのリンク。`label`（リンクの文言）と `url` を持つ。自分の環境に導入して使う作品だけに書く |
| `publishedAt` | 文字列 | 公開日（`YYYY-MM-DD`）。新しい順に並べる。制作中の作品では省略できる |
| `status` | `"coming-soon"`（省略可） | 制作中の作品に書く。カードに「Coming Soon」の目印を付け、リンクの代わりに「制作中」と出す。公開中の作品の後ろに並べる |
| `releaseNote` | 文字列（省略可） | 制作中の作品の公開時期の目安（例: `2027年春 公開予定`）。「制作中・〇〇」と表示する |

制作中の作品を公開するときは、`status`・`releaseNote` を消し、`url` と `publishedAt` を書く。
