param(
  [int]$Port = 4173
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot "dist"
$outputPath = Join-Path $projectRoot "docs\visual-check"
$chromeProfilePath = Join-Path $projectRoot ".tmp\chrome-visual-check"
$browsers = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
$availableBrowsers = $browsers | Where-Object { Test-Path $_ }

if (!(Test-Path $distPath)) {
  throw "Folder dist tidak ditemukan. Jalankan npm run build dulu."
}

if (!$availableBrowsers -or $availableBrowsers.Count -eq 0) {
  throw "Browser headless tidak ditemukan (Chrome/Edge)."
}

New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
New-Item -ItemType Directory -Force -Path $chromeProfilePath | Out-Null

$server = Start-Process -FilePath "python" -ArgumentList "-m", "http.server", "$Port", "--bind", "127.0.0.1" -WorkingDirectory $distPath -PassThru -WindowStyle Hidden

try {
  Start-Sleep -Seconds 2

  $captures = @(
    @{ Name = "desktop-home.png"; Width = 1440; Height = 1200; Url = "http://127.0.0.1:$Port/" },
    @{ Name = "mobile-home.png"; Width = 390; Height = 1080; Url = "http://127.0.0.1:$Port/?mobile=home" },
    @{ Name = "mobile-editor.png"; Width = 390; Height = 1080; Url = "http://127.0.0.1:$Port/?mobile=editor&tool=frame" },
    @{ Name = "mobile-share.png"; Width = 390; Height = 1080; Url = "http://127.0.0.1:$Port/?mobile=share&export=hd" }
  )

  foreach ($capture in $captures) {
    $target = Join-Path $outputPath $capture.Name
    if (Test-Path $target) {
      Remove-Item -Force $target
    }

    $captured = $false
    foreach ($browserPath in $availableBrowsers) {
      try {
        & $browserPath `
          --headless=new `
          --disable-gpu `
          --no-sandbox `
          --no-first-run `
          "--user-data-dir=$chromeProfilePath" `
          --disable-crash-reporter `
          --disable-breakpad `
          "--window-size=$($capture.Width),$($capture.Height)" `
          "--screenshot=$target" `
          $capture.Url | Out-Null
      } catch {
      }

      if ((Test-Path $target) -and ((Get-Item $target).Length -gt 0)) {
        $captured = $true
        break
      }
    }

    if (-not $captured) {
      throw "Gagal membuat screenshot untuk $($capture.Name)"
    }
  }

  Write-Host "Visual check selesai. Hasil ada di $outputPath"
}
finally {
  if ($server -and !$server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
}
