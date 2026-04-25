$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot "dist"
$androidAssetsPath = Join-Path $projectRoot "android-wrapper\app\src\main\assets\www"

if (-not (Test-Path $distPath)) {
    throw "Folder dist belum ada. Jalankan npm run build dulu."
}

if (Test-Path $androidAssetsPath) {
    Remove-Item -Recurse -Force $androidAssetsPath
}

New-Item -ItemType Directory -Path $androidAssetsPath | Out-Null
Copy-Item -Path (Join-Path $distPath "*") -Destination $androidAssetsPath -Recurse -Force

Write-Host "Aset Android berhasil disinkronkan ke $androidAssetsPath"
