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
└─ site/                … 公開するサイト本体（このフォルダの中身がそのまま配信される）
   ├─ index.html        … トップページ（プロフィール・作品カード一覧）
   ├─ about.html        … サイトについて（運営者・広告掲載の表記・免責事項・お問い合わせ）
   ├─ privacy.html      … プライバシーポリシー（取得する情報・Cookie・広告配信）
   ├─ 404.html          … ページが見つからないときのページ（ミニゲーム付き）
   ├─ data/
   │  └─ works.json     … 作品の一覧（カードの元データ）
   └─ assets/
      ├─ css/
      ├─ js/
      │  ├─ main.js            … 作品カードの一覧・タグの絞り込み
      │  ├─ card-tilt.js       … 作品カードの 3D チルト
      │  ├─ hero-particles.js  … 見出しの粒子演出
      │  └─ game-404.js        … 404 ページのミニゲーム
      └─ images/
         └─ works/      … 作品のサムネイル画像（<作品の id>.png など）
```

- `site/` の外のファイル（md など）は公開されない。公開したくないものは `site/` に置かない。
- ビルドは行わない（[ADR 0002](../decisions/0002_static_html_no_build.md)）。
- `404.html` は Cloudflare Pages が、存在しない URL へのアクセスに対してステータス 404 で返す。どの階層の URL でも表示されるため、中で読み込むファイルや他ページへのリンクは `/assets/...` のようにサイトの最上位からのパスで書く。
- 動きのある仕掛けの設計は [interactions.md](interactions.md) を参照。

## 作品データ（site/data/works.json）

作品を追加するときは、このファイルに 1 件足し、サムネイルを `site/assets/images/works/` に置く。

| 項目 | 型 | 内容 |
|---|---|---|
| `id` | 文字列 | 作品を表す英小文字の名前（例: `living-manager`）。サムネイルのファイル名にも使う。 |
| `title` | 文字列 | 作品名 |
| `summary` | 文字列 | 概要（カードに出す 1〜2 文） |
| `tags` | 文字列の配列 | ジャンル・技術など（例: `["ゲーム", "Flutter"]`） |
| `thumbnail` | 文字列 | サムネイルのパス（`site/` からの相対パス） |
| `url` | 文字列 | 作品本体の URL（「遊ぶ / 使ってみる」ボタンのリンク先） |
| `kind` | `"app"` / `"game"` | ボタンの文言を「使ってみる」「遊ぶ」で切り替える |
| `guide` | オブジェクト（省略可） | 導入手順へのリンク。`label`（リンクの文言）と `url` を持つ。自分の環境に導入して使う作品だけに書く |
| `publishedAt` | 文字列 | 公開日（`YYYY-MM-DD`）。新しい順に並べる |
