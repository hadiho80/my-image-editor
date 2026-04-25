$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot "dist"
$androidAssetsPath = Join-Path $projectRoot "android-wrapper\app\src\main\assets\www"

if (-not (Test-Path $distPath)) {
    throw "Folder dist belum ada. Jalankan npm run build dulu."
}

if (-not (Test-Path $androidAssetsPath)) {
    New-Item -ItemType Directory -Path $androidAssetsPath | Out-Null
} else {
    Get-ChildItem -Path $androidAssetsPath -Force | ForEach-Object {
        try {
            Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction Stop
        } catch {
            Write-Warning "Lewati file yang sedang dipakai: $($_.FullName)"
        }
    }
}

Copy-Item -Path (Join-Path $distPath "*") -Destination $androidAssetsPath -Recurse -Force

Write-Host "Aset Android berhasil disinkronkan ke $androidAssetsPath"
