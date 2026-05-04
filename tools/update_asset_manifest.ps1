$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$assets = Join-Path $root "assets"
$audioExts = @(".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".opus", ".webm", ".weba", ".mp4", ".aif", ".aiff", ".caf", ".wma", ".mid", ".midi")
$imageExts = @(".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".avif", ".svg")

function Get-AssetFiles {
  param(
    [string]$Directory,
    [string[]]$Extensions
  )

  if (!(Test-Path -LiteralPath $Directory)) {
    return @()
  }

  $rootPath = (Resolve-Path $root).Path
  return @(Get-ChildItem -LiteralPath $Directory -File -Recurse |
    Where-Object { $Extensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object FullName |
    ForEach-Object {
      $relative = $_.FullName.Substring($rootPath.Length).TrimStart("\", "/").Replace("\", "/")
      "../$relative"
    })
}

$manifest = [ordered]@{
  music = [ordered]@{}
  sfx = [ordered]@{}
  sprites = [ordered]@{}
}

foreach ($group in @("menu", "wave", "boss")) {
  $manifest.music[$group] = [object[]]@(Get-AssetFiles (Join-Path $assets "music\$group") $audioExts)
}

foreach ($group in @("pistol", "shotgun", "knife", "hit", "death", "hurt", "reload", "boss-roar", "win", "pickup")) {
  $manifest.sfx[$group] = [object[]]@(Get-AssetFiles (Join-Path $assets "sfx\$group") $audioExts)
}

foreach ($group in @("player", "zombie", "boss")) {
  $manifest.sprites[$group] = [object[]]@(Get-AssetFiles (Join-Path $assets "sprites\$group") $imageExts)
}

$json = $manifest | ConvertTo-Json -Depth 8
Set-Content -LiteralPath (Join-Path $assets "manifest.json") -Value $json -Encoding UTF8
Set-Content -LiteralPath (Join-Path $assets "manifest.js") -Value "window.DBZ_ASSET_MANIFEST = $json;" -Encoding UTF8

Write-Host "Updated assets/manifest.json and assets/manifest.js"
