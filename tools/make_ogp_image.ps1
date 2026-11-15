# SNS で共有されたときに出す画像（OGP 画像、1200×630）を作る。
# Windows 標準の System.Drawing と、Windows に入っている游明朝・游ゴシックで描くので、追加のインストールは不要。
# 使い方（リポジトリのルートで）: powershell -NoProfile -File tools/make_ogp_image.ps1
# 出力: site/assets/images/ogp.png

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$width = 1200
$height = 630
$out = Join-Path $PSScriptRoot '..\site\assets\images\ogp.png'

# サイトの配色（site/assets/css/style.css のライトモード）
$bg = [System.Drawing.ColorTranslator]::FromHtml('#fbf7f0')
$surface = [System.Drawing.ColorTranslator]::FromHtml('#fffdf9')
$text = [System.Drawing.ColorTranslator]::FromHtml('#2a2521')
$muted = [System.Drawing.ColorTranslator]::FromHtml('#6c6157')
$line = [System.Drawing.ColorTranslator]::FromHtml('#e4dacb')
$accent = [System.Drawing.ColorTranslator]::FromHtml('#a4482f')

$bmp = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear($bg)

function New-RoundedRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

# 内側のカード
$card = New-RoundedRect 48 48 ($width - 96) ($height - 96) 28
$g.FillPath((New-Object System.Drawing.SolidBrush $surface), $card)
$g.DrawPath((New-Object System.Drawing.Pen $line, 2), $card)

# 左上のロゴ（favicon と同じ「L」のマーク）
$logo = New-RoundedRect 112 112 72 72 16
$g.FillPath((New-Object System.Drawing.SolidBrush $accent), $logo)
$pen = New-Object System.Drawing.Pen $bg, 8
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$g.DrawLines($pen, [System.Drawing.PointF[]]@(
  (New-Object System.Drawing.PointF 136, 130),
  (New-Object System.Drawing.PointF 136, 166),
  (New-Object System.Drawing.PointF 161, 166)))

$serif = 'Yu Mincho'
$sans = 'Yu Gothic UI'
$px = [System.Drawing.GraphicsUnit]::Pixel
$g.DrawString('LASC Atelier', (New-Object System.Drawing.Font $serif, 44, ([System.Drawing.FontStyle]::Bold), $px), (New-Object System.Drawing.SolidBrush $text), 206, 118)

# 見出し
$titleFont = New-Object System.Drawing.Font $serif, 76, ([System.Drawing.FontStyle]::Bold), $px
$g.DrawString('つくったものを、', $titleFont, (New-Object System.Drawing.SolidBrush $text), 104, 240)
$g.DrawString('並べる場所。', $titleFont, (New-Object System.Drawing.SolidBrush $text), 104, 340)

# 下の説明とアクセントの線
$g.FillRectangle((New-Object System.Drawing.SolidBrush $accent), 112, 470, 64, 5)
$g.DrawString('自作の Web アプリ・ゲームの作品集', (New-Object System.Drawing.Font $sans, 30, ([System.Drawing.FontStyle]::Regular), $px), (New-Object System.Drawing.SolidBrush $muted), 104, 494)
$urlFont = New-Object System.Drawing.Font $sans, 26, ([System.Drawing.FontStyle]::Regular), $px
$urlText = 'lasc-atelier.pages.dev'
$urlSize = $g.MeasureString($urlText, $urlFont)
$g.DrawString($urlText, $urlFont, (New-Object System.Drawing.SolidBrush $accent), ($width - 112 - $urlSize.Width), 500)

$g.Dispose()
$bmp.Save((Resolve-Path (Split-Path $out)).Path + '\ogp.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "作成しました: $out"
