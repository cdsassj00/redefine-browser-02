param(
  [string]$OutputRoot = "docs/instagram-cards"
)

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Resolve-Path -LiteralPath "."
$out4x5 = Join-Path $root $OutputRoot
$out1x1 = Join-Path $out4x5 "safe-crop-1x1"
$out3x4 = Join-Path $out4x5 "grid-preview-3x4"

New-Item -ItemType Directory -Force -Path $out4x5 | Out-Null
New-Item -ItemType Directory -Force -Path $out1x1 | Out-Null
New-Item -ItemType Directory -Force -Path $out3x4 | Out-Null

$script:FontCollection = [System.Drawing.Text.PrivateFontCollection]::new()
foreach ($fontPath in @(
  "C:\Windows\Fonts\NotoSansKR-Regular.ttf",
  "C:\Windows\Fonts\NotoSansKR-Medium.ttf",
  "C:\Windows\Fonts\NotoSansKR-Bold.ttf"
)) {
  if (Test-Path -LiteralPath $fontPath) {
    $script:FontCollection.AddFontFile($fontPath)
  }
}

$script:SansFamily = $script:FontCollection.Families | Where-Object { $_.Name -eq "Noto Sans KR" } | Select-Object -First 1
if (-not $script:SansFamily) {
  $script:SansFamily = [System.Drawing.FontFamily]::new("Malgun Gothic")
}

function Color-Hex([string]$hex) {
  return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

function Color-Alpha([int]$alpha, [string]$hex) {
  $base = Color-Hex $hex
  return [System.Drawing.Color]::FromArgb($alpha, $base.R, $base.G, $base.B)
}

function Font-Sans([float]$size, [string]$weight = "Regular") {
  $style = if ($weight -eq "Bold") { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
  return [System.Drawing.Font]::new($script:SansFamily, $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function Path-RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Fill-Round($g, [System.Drawing.Color]$color, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $brush = [System.Drawing.SolidBrush]::new($color)
  $path = Path-RoundRect $x $y $w $h $r
  $g.FillPath($brush, $path)
  $path.Dispose()
  $brush.Dispose()
}

function Stroke-Round($g, [System.Drawing.Color]$color, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r, [float]$width = 2) {
  $pen = [System.Drawing.Pen]::new($color, $width)
  $path = Path-RoundRect $x $y $w $h $r
  $g.DrawPath($pen, $path)
  $path.Dispose()
  $pen.Dispose()
}

function Fill-Rect($g, [string]$hex, [float]$x, [float]$y, [float]$w, [float]$h) {
  $brush = [System.Drawing.SolidBrush]::new((Color-Hex $hex))
  $g.FillRectangle($brush, $x, $y, $w, $h)
  $brush.Dispose()
}

function Fill-GradientRect($g, [string]$hex1, [string]$hex2, [float]$x, [float]$y, [float]$w, [float]$h, [float]$angle = 90) {
  $rect = [System.Drawing.RectangleF]::new($x, $y, $w, $h)
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, (Color-Hex $hex1), (Color-Hex $hex2), $angle)
  $g.FillRectangle($brush, $rect)
  $brush.Dispose()
}

function Draw-Text($g, [string]$text, [float]$x, [float]$y, [float]$w, [float]$h, $font, [string]$hex, [string]$align = "Near", [string]$valign = "Near") {
  $brush = [System.Drawing.SolidBrush]::new((Color-Hex $hex))
  $format = [System.Drawing.StringFormat]::new([System.Drawing.StringFormatFlags]::NoClip)
  $format.Alignment = [System.Drawing.StringAlignment]::$align
  $format.LineAlignment = [System.Drawing.StringAlignment]::$valign
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $rect = [System.Drawing.RectangleF]::new($x, $y, $w, $h)
  $g.DrawString($text, $font, $brush, $rect, $format)
  $format.Dispose()
  $brush.Dispose()
}

function Draw-Lines($g, [string[]]$lines, [float]$x, [float]$y, [float]$w, [float]$lineHeight, $font, [string]$hex) {
  for ($i = 0; $i -lt $lines.Count; $i++) {
    Draw-Text $g $lines[$i] $x ($y + $i * $lineHeight) $w $lineHeight $font $hex
  }
}

function Draw-Line($g, [string]$hex, [float]$x1, [float]$y1, [float]$x2, [float]$y2, [float]$width = 2) {
  $pen = [System.Drawing.Pen]::new((Color-Hex $hex), $width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($pen, $x1, $y1, $x2, $y2)
  $pen.Dispose()
}

function Draw-Dot($g, [string]$hex, [float]$x, [float]$y, [float]$size) {
  $brush = [System.Drawing.SolidBrush]::new((Color-Hex $hex))
  $g.FillEllipse($brush, $x, $y, $size, $size)
  $brush.Dispose()
}

function Draw-Background($g, $card) {
  Fill-GradientRect $g $card.BgTop $card.BgBottom 0 0 1080 1350 90

  $wash = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $wash.StartFigure()
  $wash.AddBezier(-120, 1090, 170, 950, 430, 1160, 720, 1010)
  $wash.AddBezier(870, 930, 1010, 1010, 1200, 880, 1220, 1250)
  $wash.AddLine(1220, 1400, -120, 1400)
  $wash.CloseFigure()
  $brushWash = [System.Drawing.SolidBrush]::new((Color-Alpha 72 $card.Accent))
  $g.FillPath($brushWash, $wash)
  $brushWash.Dispose()
  $wash.Dispose()

  $deep = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $deep.StartFigure()
  $deep.AddBezier(410, 1370, 610, 1180, 820, 1050, 1160, 930)
  $deep.AddLine(1160, 1370)
  $deep.CloseFigure()
  $brushDeep = [System.Drawing.SolidBrush]::new((Color-Alpha 220 $card.Deep))
  $g.FillPath($brushDeep, $deep)
  $brushDeep.Dispose()
  $deep.Dispose()

  $dotBrush = [System.Drawing.SolidBrush]::new((Color-Alpha 80 $card.Accent))
  for ($row = 0; $row -lt 7; $row++) {
    for ($col = 0; $col -lt 7; $col++) {
      $g.FillEllipse($dotBrush, 86 + $col * 18, 1010 + $row * 18, 4, 4)
    }
  }
  $dotBrush.Dispose()

  Fill-Round $g (Color-Alpha 238 "#FFFDF7") 148 122 784 1110 30
  Stroke-Round $g (Color-Alpha 70 "#0F172A") 148 122 784 1110 30 1
}

function Draw-Header($g, $card) {
  Fill-Round $g (Color-Hex $card.AccentSoft) 204 168 100 54 27
  Draw-Text $g "$($card.No)/05" 204 177 100 34 (Font-Sans 24 "Bold") $card.Accent "Center"
  Draw-Text $g "국내증시 수급분석기" 328 177 312 34 (Font-Sans 23 "Bold") $card.Ink
  Draw-Text $g "CDSA" 770 178 104 32 (Font-Sans 18 "Bold") $card.Muted "Far"
  Draw-Line $g $card.Line 204 250 876 250 2
}

function Draw-Title($g, $card, [float]$y, [string[]]$title, [float]$size = 72, [float]$lineHeight = 86) {
  Draw-Lines $g $title 204 $y 672 $lineHeight (Font-Sans $size "Bold") $card.Ink
  $afterY = $y + ($title.Count * $lineHeight) + 8
  Draw-Line $g $card.Accent 204 $afterY 304 $afterY 7
}

function Draw-BrowserPanel($g, $card, [float]$x, [float]$y, [float]$w, [float]$h) {
  Fill-Round $g (Color-Alpha 24 "#0F172A") ($x + 10) ($y + 12) $w $h 8
  Fill-Round $g (Color-Hex "#FFFFFF") $x $y $w $h 8
  Stroke-Round $g (Color-Hex $card.Line) $x $y $w $h 8 2

  Draw-Dot $g "#EF4444" ($x + 30) ($y + 28) 14
  Draw-Dot $g "#F59E0B" ($x + 56) ($y + 28) 14
  Draw-Dot $g $card.Accent ($x + 82) ($y + 28) 14

  if ($h -lt 260) {
    Draw-Text $g "수급 그래프" ($x + 30) ($y + 70) 180 30 (Font-Sans 22 "Bold") $card.Ink
    $chartX = $x + 220
    $axisY = $y + $h - 42
    Draw-Line $g "#DCE5DF" $chartX $axisY ($x + $w - 42) $axisY 3
    $bars = @(76, 116, 94, 150, 112, 172, 132)
    for ($i = 0; $i -lt $bars.Count; $i++) {
      $barX = $chartX + $i * 52
      $barH = $bars[$i] * 0.58
      $color = if ($i % 2 -eq 0) { $card.Accent } else { "#2563EB" }
      Fill-Round $g (Color-Hex $color) $barX ($axisY - $barH) 32 $barH 8
    }
    $pen = [System.Drawing.Pen]::new((Color-Hex "#EF4444"), 7)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $points = @(
      [System.Drawing.PointF]::new($chartX, $axisY - 22),
      [System.Drawing.PointF]::new($chartX + 84, $axisY - 46),
      [System.Drawing.PointF]::new($chartX + 168, $axisY - 34),
      [System.Drawing.PointF]::new($chartX + 252, $axisY - 82),
      [System.Drawing.PointF]::new($chartX + 336, $axisY - 70),
      [System.Drawing.PointF]::new($chartX + 420, $axisY - 112)
    )
    $g.DrawLines($pen, $points)
    $pen.Dispose()
    return
  }

  Draw-Text $g "수급 판정" ($x + 30) ($y + 74) 160 32 (Font-Sans 23 "Bold") $card.Ink
  Draw-Text $g "매수 우위" ($x + 30) ($y + 110) 245 58 (Font-Sans 43 "Bold") $card.Accent

  $chartX = $x + 250
  $axisY = $y + $h - 72
  Draw-Line $g "#DCE5DF" $chartX $axisY ($x + $w - 42) $axisY 3
  $bars = @(84, 128, 104, 168, 120, 208, 154)
  for ($i = 0; $i -lt $bars.Count; $i++) {
    $barX = $chartX + $i * 48
    $barH = $bars[$i] * [Math]::Min(1, ($h - 118) / 220)
    $color = if ($i % 2 -eq 0) { $card.Accent } else { "#2563EB" }
    Fill-Round $g (Color-Hex $color) $barX ($axisY - $barH) 30 $barH 8
  }

  $pen = [System.Drawing.Pen]::new((Color-Hex "#EF4444"), 7)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $points = @(
    [System.Drawing.PointF]::new($chartX, $axisY - 18),
    [System.Drawing.PointF]::new($chartX + 84, $axisY - 48),
    [System.Drawing.PointF]::new($chartX + 168, $axisY - 34),
    [System.Drawing.PointF]::new($chartX + 252, $axisY - 104),
    [System.Drawing.PointF]::new($chartX + 336, $axisY - 86),
    [System.Drawing.PointF]::new($chartX + 420, $axisY - 140)
  )
  $g.DrawLines($pen, $points)
  $pen.Dispose()
}

function Draw-Metric($g, $card, [string]$label, [string]$value, [float]$x, [float]$y, [float]$w = 392) {
  Fill-Round $g (Color-Hex "#FFFFFF") $x $y $w 112 8
  Stroke-Round $g (Color-Hex $card.Line) $x $y $w 112 8 2
  Draw-Text $g $value ($x + 24) ($y + 24) ($w - 48) 40 (Font-Sans 33 "Bold") $card.Ink
  Draw-Text $g $label ($x + 24) ($y + 67) ($w - 48) 30 (Font-Sans 21 "Regular") $card.Muted
}

function Draw-QuestionRow($g, $card, [string]$text, [float]$x, [float]$y) {
  Fill-Rect $g $card.Accent $x ($y + 10) 18 18
  Draw-Text $g $text ($x + 38) $y 640 42 (Font-Sans 29 "Bold") $card.Ink
}

function Draw-FlowActors($g, $card, [float]$x, [float]$y) {
  $items = @(
    @("외국인", $card.Accent),
    @("기관", "#2563EB"),
    @("개인", "#EF4444")
  )
  for ($i = 0; $i -lt $items.Count; $i++) {
    $cx = $x + $i * 218
    Fill-Round $g (Color-Hex "#FFFFFF") $cx $y 158 162 18
    Stroke-Round $g (Color-Hex $card.Line) $cx $y 158 162 18 2
    Fill-Rect $g $items[$i][1] $cx $y 158 8
    Draw-Text $g $items[$i][0] $cx ($y + 54) 158 46 (Font-Sans 31 "Bold") $items[$i][1] "Center"
    Draw-Text $g "순매수/순매도" $cx ($y + 104) 158 28 (Font-Sans 18 "Regular") $card.Muted "Center"
    if ($i -lt 2) {
      Draw-Line $g "#9AA6A0" ($cx + 174) ($y + 82) ($cx + 204) ($y + 82) 4
      $arrow = [System.Drawing.Pen]::new((Color-Hex "#9AA6A0"), 5)
      $arrow.EndCap = [System.Drawing.Drawing2D.LineCap]::Triangle
      $g.DrawLine($arrow, $cx + 190, $y + 82, $cx + 204, $y + 82)
      $arrow.Dispose()
    }
  }
}

function Draw-StepRail($g, $card, [float]$x, [float]$y) {
  $steps = @("표", "그래프", "점수", "전략")
  Draw-Line $g "#CBD5CF" ($x + 70) ($y + 62) ($x + 588) ($y + 62) 5
  for ($i = 0; $i -lt $steps.Count; $i++) {
    $cx = $x + $i * 172
    $fill = if ($i -eq 3) { $card.Accent } else { "#FFFFFF" }
    $fg = if ($i -eq 3) { "#FFFFFF" } else { $card.Ink }
    Fill-Round $g (Color-Hex $fill) $cx $y 132 126 18
    Stroke-Round $g (Color-Hex $(if ($i -eq 3) { $card.Accent } else { $card.Line })) $cx $y 132 126 18 2
    Draw-Text $g ("0" + ($i + 1)) ($cx + 18) ($y + 18) 50 26 (Font-Sans 18 "Bold") $(if ($i -eq 3) { "#DDF7E8" } else { $card.Accent })
    Draw-Text $g $steps[$i] $cx ($y + 50) 132 48 (Font-Sans 32 "Bold") $fg "Center"
  }
}

function Draw-LinkBox($g, $card, [string]$label, [string]$url, [float]$x, [float]$y, [string]$accent) {
  Fill-Round $g (Color-Hex "#FFFFFF") $x $y 672 126 18
  Stroke-Round $g (Color-Hex $card.Line) $x $y 672 126 18 2
  Fill-Rect $g $accent $x $y 8 126
  Draw-Text $g $label ($x + 34) ($y + 23) 180 28 (Font-Sans 21 "Bold") $accent
  Draw-Text $g $url ($x + 34) ($y + 62) 595 40 (Font-Sans 25 "Bold") $card.Ink
}

function Draw-Card([hashtable]$card, [string]$path) {
  $bmp = [System.Drawing.Bitmap]::new(1080, 1350)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

  Draw-Background $g $card
  Draw-Header $g $card

  switch ($card.Mode) {
    "cover" {
      Draw-Text $g "NAVER FINANCE DATA TOOL" 204 308 520 28 (Font-Sans 18 "Bold") $card.Accent
      Draw-Title $g $card 348 $card.Title 63 77
      Draw-Text $g "120거래일 수급을 읽는 Chrome 확장프로그램" 204 532 640 42 (Font-Sans 25 "Regular") $card.Muted
      Draw-BrowserPanel $g $card 204 664 672 318
      Draw-Text $g "GitHub 공개 · CDSA.kr" 204 1064 360 34 (Font-Sans 23 "Bold") $card.Ink
      Draw-Text $g "외국인·기관·개인" 650 1064 226 34 (Font-Sans 19 "Regular") $card.Muted "Far"
    }
    "why" {
      Draw-Title $g $card 330 $card.Title 63 78
      Draw-Text $g "주가는 결과이고, 수급은 그 결과를 만든 돈의 흐름입니다." 204 518 640 88 (Font-Sans 28 "Regular") $card.Muted
      Draw-FlowActors $g $card 204 650
      Draw-QuestionRow $g $card "누가 사고 있는가" 204 882
      Draw-QuestionRow $g $card "누가 빠지고 있는가" 204 946
      Draw-QuestionRow $g $card "그 수급이 가격을 지지하는가" 204 1010
    }
    "dashboard" {
      Draw-Title $g $card 320 $card.Title 61 76
      Draw-Metric $g $card "거래일 장기 수급" "20 / 60 / 120" 204 528 306
      Draw-Metric $g $card "누적 순매수·순매도" "외국인 + 기관" 570 528 306
      Draw-Metric $g $card "잔여 흐름 추정" "개인 / 기타" 204 672 306
      Draw-Metric $g $card "추세 변화 확인" "외국인 보유율" 570 672 306
      Draw-BrowserPanel $g $card 224 850 632 214
    }
    "strategy" {
      Draw-Title $g $card 330 $card.Title 60 74
      Draw-Text $g "수급 데이터를 판단 가능한 형태로 바꿉니다." 204 516 640 44 (Font-Sans 28 "Regular") $card.Muted
      Draw-StepRail $g $card 204 636
      Draw-Metric $g $card "수급 점수 기반" "매수 우위" 204 838 306
      Draw-Metric $g $card "확인 신호 필요" "조건부 매수" 570 838 306
      Draw-Text $g "투자 권유가 아닌 수급 기준 기계적 분류" 204 1034 620 40 (Font-Sans 23 "Regular") $card.Muted
    }
    "links" {
      Draw-Title $g $card 318 $card.Title 60 74
      Draw-Text $g "소스 코드와 설치용 ZIP은 GitHub에 공개했습니다." 204 492 640 48 (Font-Sans 26 "Regular") $card.Muted
      Draw-LinkBox $g $card "GitHub" "github.com/cdsassj00/redefine-browser-02" 204 610 "#111827"
      Draw-LinkBox $g $card "CDSA" "cdsa.kr" 204 782 $card.Accent
      Draw-Line $g $card.Line 204 956 876 956 2
      Draw-Text $g "AI·데이터 교육과 바이브 코딩" 204 998 640 42 (Font-Sans 30 "Bold") $card.Ink
      Draw-Text $g "현장에서 바로 쓰는 도구 제작까지" 204 1045 640 36 (Font-Sans 25 "Regular") $card.Muted
    }
  }

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

$cards = @(
  @{
    No = "01"; Mode = "cover"; Accent = "#00B050"; AccentSoft = "#E6F7EE"; Ink = "#101814"; Muted = "#5E6C66"; Line = "#DDE6E0"; BgTop = "#F9F4EA"; BgBottom = "#DBF2E7"; Deep = "#102A43";
    Title = @("가격보다 먼저", "돈의 흐름을 봅니다")
  },
  @{
    No = "02"; Mode = "why"; Accent = "#E86100"; AccentSoft = "#FFF0E4"; Ink = "#151515"; Muted = "#636D68"; Line = "#E2E5DD"; BgTop = "#FFF2E3"; BgBottom = "#EFEFE7"; Deep = "#23212B";
    Title = @("왜 수급분석이", "중요할까?")
  },
  @{
    No = "03"; Mode = "dashboard"; Accent = "#0EA5A4"; AccentSoft = "#E4F7F5"; Ink = "#10201D"; Muted = "#64706B"; Line = "#DCE6E2"; BgTop = "#EFF9F7"; BgBottom = "#DDEEF1"; Deep = "#0F2D3C";
    Title = @("5일 표에서", "120거래일 대시보드로")
  },
  @{
    No = "04"; Mode = "strategy"; Accent = "#2563EB"; AccentSoft = "#E9F0FF"; Ink = "#111827"; Muted = "#667085"; Line = "#DDE3EC"; BgTop = "#EFF4FF"; BgBottom = "#E8EEE7"; Deep = "#10182F";
    Title = @("표에서 끝내지 않고", "전략까지")
  },
  @{
    No = "05"; Mode = "links"; Accent = "#00B050"; AccentSoft = "#E6F7EE"; Ink = "#101814"; Muted = "#606E68"; Line = "#DDE6E0"; BgTop = "#F9F4EA"; BgBottom = "#E6F3E9"; Deep = "#102A43";
    Title = @("GitHub에서 받고", "CDSA에서 배웁니다")
  }
)

foreach ($card in $cards) {
  $fileName = "card-{0}-{1}.png" -f $card.No, $card.Mode
  $fullPath = Join-Path $out4x5 $fileName
  Draw-Card $card $fullPath

  $source = [System.Drawing.Bitmap]::FromFile($fullPath)
  $crop = [System.Drawing.Rectangle]::new(0, 135, 1080, 1080)
  $target = $source.Clone($crop, $source.PixelFormat)
  $safePath = Join-Path $out1x1 $fileName
  $target.Save($safePath, [System.Drawing.Imaging.ImageFormat]::Png)
  $target.Dispose()
  $source.Dispose()

  $source3x4 = [System.Drawing.Bitmap]::FromFile($fullPath)
  $crop3x4 = [System.Drawing.Rectangle]::new(34, 0, 1012, 1350)
  $target3x4 = $source3x4.Clone($crop3x4, $source3x4.PixelFormat)
  $gridPath = Join-Path $out3x4 $fileName
  $target3x4.Save($gridPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $target3x4.Dispose()
  $source3x4.Dispose()
}

$previewFiles = Get-ChildItem -LiteralPath $out3x4 -Filter "card-*.png" | Sort-Object Name
if ($previewFiles.Count -gt 0) {
  $thumbW = 280
  $thumbH = 374
  $gap = 2
  $stripW = ($thumbW * $previewFiles.Count) + ($gap * ($previewFiles.Count - 1))
  $strip = [System.Drawing.Bitmap]::new($stripW, $thumbH)
  $sg = [System.Drawing.Graphics]::FromImage($strip)
  $sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  Fill-GradientRect $sg "#FAFAFA" "#F1F5F2" 0 0 $stripW $thumbH 90
  for ($i = 0; $i -lt $previewFiles.Count; $i++) {
    $src = [System.Drawing.Bitmap]::FromFile($previewFiles[$i].FullName)
    $x = $i * ($thumbW + $gap)
    $sg.DrawImage($src, [System.Drawing.Rectangle]::new($x, 0, $thumbW, $thumbH))
    $src.Dispose()
  }
  $stripPath = Join-Path $out4x5 "grid-preview-row.png"
  $strip.Save($stripPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $sg.Dispose()
  $strip.Dispose()
}

Write-Output "Generated 4:5 cards: $out4x5"
Write-Output "Generated 1:1 safe crops: $out1x1"
Write-Output "Generated 3:4 grid previews: $out3x4"
