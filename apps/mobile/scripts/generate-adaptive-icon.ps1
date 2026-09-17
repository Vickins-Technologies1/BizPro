param(
  [string]$Source = (Join-Path $PSScriptRoot "..\assets\brand\dira-os-logo.png"),
  [string]$ForegroundOutput = (Join-Path $PSScriptRoot "..\assets\brand\dira-os-adaptive-foreground.png"),
  [string]$IconOutput = (Join-Path $PSScriptRoot "..\assets\brand\dira-os-mobile-icon-safe.png")
)

Add-Type -AssemblyName System.Drawing

# Android's adaptive-icon canvas is 108dp and its never-clipped safe zone is 66dp.
# A 620px logo on this 1024px canvas is just under that 66/108 (626px) maximum.
$canvasSize = 1024
$safeLogoSize = 620
$alphaThreshold = 16

$sourceImage = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Source))
try {
  $left = $sourceImage.Width
  $top = $sourceImage.Height
  $right = -1
  $bottom = -1

  for ($y = 0; $y -lt $sourceImage.Height; $y++) {
    for ($x = 0; $x -lt $sourceImage.Width; $x++) {
      if ($sourceImage.GetPixel($x, $y).A -ge $alphaThreshold) {
        $left = [Math]::Min($left, $x)
        $top = [Math]::Min($top, $y)
        $right = [Math]::Max($right, $x)
        $bottom = [Math]::Max($bottom, $y)
      }
    }
  }

  if ($right -lt $left -or $bottom -lt $top) {
    throw "The source logo has no visible pixels."
  }

  $sourceBounds = [System.Drawing.Rectangle]::FromLTRB($left, $top, $right + 1, $bottom + 1)
  $scale = [Math]::Min($safeLogoSize / $sourceBounds.Width, $safeLogoSize / $sourceBounds.Height)
  $targetWidth = [Math]::Round($sourceBounds.Width * $scale)
  $targetHeight = [Math]::Round($sourceBounds.Height * $scale)
  $targetBounds = [System.Drawing.Rectangle]::new(
    [Math]::Round(($canvasSize - $targetWidth) / 2),
    [Math]::Round(($canvasSize - $targetHeight) / 2),
    $targetWidth,
    $targetHeight
  )

  function Save-LogoLayer([System.Drawing.Color]$background, [string]$output) {
    $bitmap = [System.Drawing.Bitmap]::new($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear($background)
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($sourceImage, $targetBounds, $sourceBounds, [System.Drawing.GraphicsUnit]::Pixel)
      }
      finally {
        $graphics.Dispose()
      }

      $bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $bitmap.Dispose()
    }
  }

  Save-LogoLayer ([System.Drawing.Color]::Transparent) $ForegroundOutput
  Save-LogoLayer ([System.Drawing.Color]::White) $IconOutput

  $androidResRoot = Join-Path $PSScriptRoot "..\android\app\src\main\res"
  $mipmapSizes = @{ mdpi = 108; hdpi = 162; xhdpi = 216; xxhdpi = 324; xxxhdpi = 432 }

  function Save-ResizedIcon([string]$sourcePath, [string]$output, [int]$size, [System.Drawing.Color]$background) {
    $inputBitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path $sourcePath))
    $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear($background)
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($inputBitmap, [System.Drawing.Rectangle]::new(0, 0, $size, $size))
      }
      finally {
        $graphics.Dispose()
      }
      $bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $inputBitmap.Dispose()
      $bitmap.Dispose()
    }
  }

  foreach ($density in $mipmapSizes.Keys) {
    $mipmapDirectory = Join-Path $androidResRoot "mipmap-$density"
    $size = $mipmapSizes[$density]
    Save-ResizedIcon $ForegroundOutput (Join-Path $mipmapDirectory "ic_launcher_foreground.png") $size ([System.Drawing.Color]::Transparent)
    Save-ResizedIcon $IconOutput (Join-Path $mipmapDirectory "ic_launcher.png") $size ([System.Drawing.Color]::White)
    Save-ResizedIcon $IconOutput (Join-Path $mipmapDirectory "ic_launcher_round.png") $size ([System.Drawing.Color]::White)
    Copy-Item (Join-Path $mipmapDirectory "ic_launcher_foreground.png") (Join-Path $mipmapDirectory "ic_launcher_foreground.webp") -Force
    Copy-Item (Join-Path $mipmapDirectory "ic_launcher.png") (Join-Path $mipmapDirectory "ic_launcher.webp") -Force
    Copy-Item (Join-Path $mipmapDirectory "ic_launcher_round.png") (Join-Path $mipmapDirectory "ic_launcher_round.webp") -Force
  }

  Write-Output "Visible logo bounds: $($targetWidth)x$($targetHeight) centered at ($($targetBounds.X), $($targetBounds.Y)) on a ${canvasSize}x${canvasSize} canvas."
}
finally {
  $sourceImage.Dispose()
}
