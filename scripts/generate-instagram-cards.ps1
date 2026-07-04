param(
  [string]$OutputRoot = "docs/instagram-cards"
)

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Resolve-Path -LiteralPath "."
$out4x5 = Join-Path $root $OutputRoot
$out1x1 = Join-Path $out4x5 "safe-crop-1x1"

New-Item -ItemType Directory -Force -Path $out4x5 | Out-Null
New-Item -ItemType Directory -Force -Path $out1x1 | Out-Null

function ColorFromHex([string]$hex) {
  return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

function New-Font([float]$size, [System.Drawing.FontStyle]$style = [System.Drawing.FontStyle]::Regular) {
  return [System.Drawing.Font]::new("Malgun Gothic", $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function New-RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Fill-RoundRect($g, [System.Drawing.Brush]$brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-RoundRect $x $y $w $h $r
  $g.FillPath($brush, $path)
  $path.Dispose()
}

function Stroke-RoundRect($g, [System.Drawing.Pen]$pen, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-RoundRect $x $y $w $h $r
  $g.DrawPath($pen, $path)
  $path.Dispose()
}

function Draw-Text($g, [string]$text, [float]$x, [float]$y, [float]$w, [float]$h, $font, [string]$color, [string]$align = "Near") {
  $brush = [System.Drawing.SolidBrush]::new((ColorFromHex $color))
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::$align
  $format.LineAlignment = [System.Drawing.StringAlignment]::Near
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $rect = [System.Drawing.RectangleF]::new($x, $y, $w, $h)
  $g.DrawString($text, $font, $brush, $rect, $format)
  $format.Dispose()
  $brush.Dispose()
}

function Draw-Lines($g, [string[]]$lines, [float]$x, [float]$y, [float]$w, [float]$lineHeight, $font, [string]$color, [string]$align = "Near") {
  for ($i = 0; $i -lt $lines.Count; $i++) {
    Draw-Text $g $lines[$i] $x ($y + $i * $lineHeight) $w $lineHeight $font $color $align
  }
}

function Draw-Chip($g, [string]$text, [float]$x, [float]$y, [float]$w, [string]$bg, [string]$fg) {
  $brush = [System.Drawing.SolidBrush]::new((ColorFromHex $bg))
  Fill-RoundRect $g $brush $x $y $w 54 27
  $brush.Dispose()
  Draw-Text $g $text ($x + 20) ($y + 12) ($w - 40) 30 (New-Font 22 ([System.Drawing.FontStyle]::Bold)) $fg "Center"
}

function Draw-Header($g, $card) {
  $safeY = 135
  $muted = $card.Muted
  $text = $card.Text
  $accent = $card.Accent
  Draw-Text $g "$($card.No)/05" 92 ($safeY + 42) 140 42 (New-Font 30 ([System.Drawing.FontStyle]::Bold)) $accent
  Draw-Text $g "국내증시 수급분석기" 232 ($safeY + 44) 410 38 (New-Font 24 ([System.Drawing.FontStyle]::Bold)) $text
  Draw-Text $g "CDSA × GitHub" 720 ($safeY + 48) 270 36 (New-Font 22 ([System.Drawing.FontStyle]::Regular)) $muted "Far"
}

function Draw-BrowserMock($g, [float]$x, [float]$y, [float]$w, [float]$h, $card) {
  $panel = [System.Drawing.SolidBrush]::new((ColorFromHex "#FFFFFF"))
  $line = [System.Drawing.Pen]::new((ColorFromHex "#DDE7E1"), 3)
  Fill-RoundRect $g $panel $x $y $w $h 34
  Stroke-RoundRect $g $line $x $y $w $h 34
  $panel.Dispose()
  $line.Dispose()

  $dotColors = @("#FF6B6B", "#FDBA2D", "#20C997")
  for ($i = 0; $i -lt 3; $i++) {
    $b = [System.Drawing.SolidBrush]::new((ColorFromHex $dotColors[$i]))
    $g.FillEllipse($b, $x + 32 + $i * 34, $y + 30, 18, 18)
    $b.Dispose()
  }

  Draw-Text $g "수급 판정" ($x + 42) ($y + 82) 180 34 (New-Font 24 ([System.Drawing.FontStyle]::Bold)) "#17201B"
  Draw-Text $g "매수 우위" ($x + 42) ($y + 122) 250 54 (New-Font 40 ([System.Drawing.FontStyle]::Bold)) $card.Accent

  $axisY = $y + $h - 60
  $chartX = $x + 220
  $chartScale = [Math]::Max(0.35, [Math]::Min(1.0, ($h - 130) / 230))
  $axisPen = [System.Drawing.Pen]::new((ColorFromHex "#E7EEE9"), 3)
  $g.DrawLine($axisPen, $chartX, $axisY, $x + $w - 50, $axisY)
  $axisPen.Dispose()

  $bars = @(92, 154, 116, 196, 132, 236, 172)
  for ($i = 0; $i -lt $bars.Count; $i++) {
    $barX = $chartX + $i * 55
    $barH = $bars[$i] * $chartScale
    $c = if ($i % 2 -eq 0) { $card.Accent } else { "#1C64F2" }
    $b = [System.Drawing.SolidBrush]::new((ColorFromHex $c))
    Fill-RoundRect $g $b $barX ($axisY - $barH) 36 $barH 14
    $b.Dispose()
  }

  $linePen = [System.Drawing.Pen]::new((ColorFromHex "#E03131"), 7)
  $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $lineScale = $chartScale * 0.85
  $points = @(
    [System.Drawing.PointF]::new($chartX, $axisY - 24 * $lineScale),
    [System.Drawing.PointF]::new($chartX + 86, $axisY - 58 * $lineScale),
    [System.Drawing.PointF]::new($chartX + 174, $axisY - 38 * $lineScale),
    [System.Drawing.PointF]::new($chartX + 270, $axisY - 126 * $lineScale),
    [System.Drawing.PointF]::new($chartX + 360, $axisY - 104 * $lineScale),
    [System.Drawing.PointF]::new($chartX + 460, $axisY - 176 * $lineScale)
  )
  $g.DrawLines($linePen, $points)
  $linePen.Dispose()
}

function Draw-MoneyFlow($g, [float]$x, [float]$y, $card) {
  $colors = @($card.Accent, "#1C64F2", "#E03131")
  $labels = @("외국인", "기관", "개인")
  for ($i = 0; $i -lt 3; $i++) {
    $b = [System.Drawing.SolidBrush]::new((ColorFromHex $colors[$i]))
    $g.FillEllipse($b, $x + $i * 220, $y, 150, 150)
    $b.Dispose()
    Draw-Text $g $labels[$i] ($x + $i * 220) ($y + 52) 150 44 (New-Font 30 ([System.Drawing.FontStyle]::Bold)) "#FFFFFF" "Center"
    if ($i -lt 2) {
      $pen = [System.Drawing.Pen]::new((ColorFromHex "#9AA6A0"), 8)
      $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
      $g.DrawLine($pen, $x + 160 + $i * 220, $y + 75, $x + 210 + $i * 220, $y + 75)
      $pen.Dispose()
    }
  }
}

function Draw-Steps($g, [float]$x, [float]$y, $card) {
  $steps = @("표", "그래프", "점수", "전략")
  for ($i = 0; $i -lt $steps.Count; $i++) {
    $boxX = $x + $i * 210
    $brush = [System.Drawing.SolidBrush]::new((ColorFromHex $(if ($i -eq 3) { $card.Accent } else { "#FFFFFF" })))
    Fill-RoundRect $g $brush $boxX $y 164 126 30
    $brush.Dispose()
    $pen = [System.Drawing.Pen]::new((ColorFromHex "#DDE7E1"), 3)
    Stroke-RoundRect $g $pen $boxX $y 164 126 30
    $pen.Dispose()
    Draw-Text $g $steps[$i] $boxX ($y + 39) 164 50 (New-Font 38 ([System.Drawing.FontStyle]::Bold)) $(if ($i -eq 3) { "#FFFFFF" } else { "#17201B" }) "Center"
    if ($i -lt $steps.Count - 1) {
      $arrow = [System.Drawing.Pen]::new((ColorFromHex "#7B8781"), 6)
      $arrow.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
      $g.DrawLine($arrow, $boxX + 174, $y + 63, $boxX + 204, $y + 63)
      $arrow.Dispose()
    }
  }
}

function Draw-Card([hashtable]$card, [string]$path) {
  $w = 1080
  $h = 1350
  $bmp = [System.Drawing.Bitmap]::new($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $bg1 = ColorFromHex $card.Bg1
  $bg2 = ColorFromHex $card.Bg2
  $grad = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Rectangle]::new(0, 0, $w, $h), $bg1, $bg2, 90)
  $g.FillRectangle($grad, 0, 0, $w, $h)
  $grad.Dispose()

  $safeY = 135
  $safeBrush = [System.Drawing.SolidBrush]::new((ColorFromHex "#F8FBF9"))
  Fill-RoundRect $g $safeBrush 54 ($safeY + 20) 972 1040 42
  $safeBrush.Dispose()

  Draw-Header $g $card

  switch ($card.Mode) {
    "cover" {
      Draw-Lines $g $card.Title 92 332 896 92 (New-Font 76 ([System.Drawing.FontStyle]::Bold)) $card.Text "Near"
      Draw-Text $g $card.Subtitle 96 542 760 52 (New-Font 34 ([System.Drawing.FontStyle]::Regular)) $card.Muted
      Draw-BrowserMock $g 96 668 650 368 $card
      Draw-Chip $g "국내 주식 전용" 96 1080 232 "#E9F7EF" $card.Accent
      Draw-Chip $g "GitHub 공개" 350 1080 210 "#EEF2FF" "#1C64F2"
      Draw-Chip $g "CDSA.kr" 582 1080 170 "#FFF4E8" "#F97316"
    }
    "why" {
      Draw-Lines $g $card.Title 92 318 896 82 (New-Font 66 ([System.Drawing.FontStyle]::Bold)) $card.Text
      Draw-Text $g "주가는 결과이고, 수급은 그 가격을 만든 돈의 흐름입니다." 96 500 840 94 (New-Font 34 ([System.Drawing.FontStyle]::Regular)) $card.Muted
      Draw-MoneyFlow $g 124 650 $card
      $items = @("누가 사고 있는가", "누가 빠지고 있는가", "그 수급이 가격을 지지하는가")
      for ($i = 0; $i -lt $items.Count; $i++) {
        Draw-Chip $g $items[$i] 110 (865 + $i * 72) 430 "#FFFFFF" $card.Text
      }
    }
    "dashboard" {
      Draw-Lines $g $card.Title 92 318 896 76 (New-Font 62 ([System.Drawing.FontStyle]::Bold)) $card.Text
      $metrics = @(
        @("20/60/120", "거래일"),
        @("외국인+기관", "누적 흐름"),
        @("개인/기타", "잔여 추정"),
        @("보유율", "변화 추적")
      )
      for ($i = 0; $i -lt $metrics.Count; $i++) {
        $x = 96 + ($i % 2) * 438
        $y = 518 + [math]::Floor($i / 2) * 150
        $b = [System.Drawing.SolidBrush]::new((ColorFromHex "#FFFFFF"))
        Fill-RoundRect $g $b $x $y 390 116 28
        $b.Dispose()
        Draw-Text $g $metrics[$i][0] ($x + 26) ($y + 22) 338 42 (New-Font 31 ([System.Drawing.FontStyle]::Bold)) $card.Text
        Draw-Text $g $metrics[$i][1] ($x + 26) ($y + 66) 338 32 (New-Font 23 ([System.Drawing.FontStyle]::Regular)) $card.Muted
      }
      Draw-BrowserMock $g 156 850 660 240 $card
    }
    "strategy" {
      Draw-Lines $g $card.Title 92 320 896 76 (New-Font 60 ([System.Drawing.FontStyle]::Bold)) $card.Text
      Draw-Text $g "수급 데이터를 판단 가능한 형태로 바꿉니다." 96 488 860 56 (New-Font 32 ([System.Drawing.FontStyle]::Regular)) $card.Muted
      Draw-Steps $g 98 630 $card
      $labels = @("매수 우위", "조건부 매수", "관망", "매도 우위")
      for ($i = 0; $i -lt $labels.Count; $i++) {
        Draw-Chip $g $labels[$i] (102 + ($i % 2) * 360) (846 + [math]::Floor($i / 2) * 78) 300 "#FFFFFF" $card.Text
      }
      Draw-Text $g "투자 권유가 아닌 수급 기준 기계적 분류" 104 1040 720 42 (New-Font 25 ([System.Drawing.FontStyle]::Regular)) $card.Muted
    }
    "links" {
      Draw-Lines $g $card.Title 92 314 896 78 (New-Font 64 ([System.Drawing.FontStyle]::Bold)) $card.Text
      Draw-Text $g "소스 코드와 설치용 ZIP은 GitHub에 공개했습니다." 96 492 840 52 (New-Font 32 ([System.Drawing.FontStyle]::Regular)) $card.Muted
      $boxes = @(
        @("GitHub", "github.com/cdsassj00/redefine-browser-02", "#101820"),
        @("CDSA", "cdsa.kr", $card.Accent)
      )
      for ($i = 0; $i -lt $boxes.Count; $i++) {
        $y = 610 + $i * 168
        $b = [System.Drawing.SolidBrush]::new((ColorFromHex "#FFFFFF"))
        Fill-RoundRect $g $b 96 $y 888 128 28
        $b.Dispose()
        Draw-Text $g $boxes[$i][0] 132 ($y + 24) 190 32 (New-Font 25 ([System.Drawing.FontStyle]::Bold)) $boxes[$i][2]
        Draw-Text $g $boxes[$i][1] 132 ($y + 62) 790 44 (New-Font 32 ([System.Drawing.FontStyle]::Bold)) $card.Text
      }
      Draw-Text $g "AI·데이터 교육과 바이브 코딩, 현장에서 바로 쓰는 도구 제작" 106 955 826 96 (New-Font 31 ([System.Drawing.FontStyle]::Regular)) $card.Text
      Draw-Text $g "한국데이터사이언티스트협회(CDSA)" 106 1065 826 40 (New-Font 25 ([System.Drawing.FontStyle]::Bold)) $card.Muted
    }
  }

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

$cards = @(
  @{
    No = "01"; Mode = "cover"; Accent = "#03C75A"; Text = "#17201B"; Muted = "#5C6963"; Bg1 = "#DFF7EA"; Bg2 = "#F4F7F6";
    Title = @("가격보다 먼저", "돈의 흐름을 봅니다"); Subtitle = "네이버 증권 기반 Chrome 확장프로그램"
  },
  @{
    No = "02"; Mode = "why"; Accent = "#F97316"; Text = "#171717"; Muted = "#626B66"; Bg1 = "#FFF3E8"; Bg2 = "#F5FAF6";
    Title = @("왜 수급분석이", "중요할까?")
  },
  @{
    No = "03"; Mode = "dashboard"; Accent = "#03C75A"; Text = "#17201B"; Muted = "#637069"; Bg1 = "#E8F7FF"; Bg2 = "#F7FBF8";
    Title = @("5일 표에서", "120거래일 대시보드로")
  },
  @{
    No = "04"; Mode = "strategy"; Accent = "#1C64F2"; Text = "#141A26"; Muted = "#667085"; Bg1 = "#EEF4FF"; Bg2 = "#F7F8F6";
    Title = @("표에서 끝내지 않고", "전략까지")
  },
  @{
    No = "05"; Mode = "links"; Accent = "#03C75A"; Text = "#142019"; Muted = "#626E68"; Bg1 = "#EAF7EF"; Bg2 = "#FFF7ED";
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
}

Write-Output "Generated 4:5 cards: $out4x5"
Write-Output "Generated 1:1 safe crops: $out1x1"
