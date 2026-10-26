# FormMind Icon Generator (PowerShell + System.Drawing)
# Generates high-definition, anti-aliased PNG icons for Chrome Extension

Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$iconsDir = Join-Path $projectRoot "icons"

# Path to the source high-res 1024x1024 master emblem
$masterPath = Join-Path $iconsDir "icon512.png"
if (-not (Test-Path $masterPath)) {
    Write-Error "Master emblem not found at $masterPath"
    exit 1
}

$img = [System.Drawing.Bitmap]::FromFile($masterPath)
$sizes = @(16, 32, 48, 128)

foreach ($s in $sizes) {
    $targetBmp = New-Object System.Drawing.Bitmap($s, $s, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($targetBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $tRect = New-Object System.Drawing.Rectangle(0, 0, $s, $s)
    $sRect = New-Object System.Drawing.Rectangle(0, 0, $img.Width, $img.Height)
    $g.DrawImage($img, $tRect, $sRect, [System.Drawing.GraphicsUnit]::Pixel)

    $outPath = Join-Path $iconsDir "icon$s.png"
    $targetBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $targetBmp.Dispose()
    Write-Output "Generated icon$s.png ($s x $s)"
}

$img.Dispose()
Write-Output "All icons successfully generated in $iconsDir!"
