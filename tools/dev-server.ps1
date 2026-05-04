param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$assets = Join-Path $root "assets"
$audioExts = @(".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".opus", ".webm", ".weba", ".mp4", ".aif", ".aiff", ".caf", ".wma", ".mid", ".midi")
$imageExts = @(".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".avif", ".svg")
$musicGroups = @("menu", "wave", "boss")
$sfxGroups = @("pistol", "shotgun", "knife", "hit", "death", "hurt", "reload", "boss-roar", "win", "pickup")
$spriteGroups = @("player", "zombie", "boss")

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".gif" = "image/gif"
  ".svg" = "image/svg+xml"
  ".mp3" = "audio/mpeg"
  ".wav" = "audio/wav"
  ".ogg" = "audio/ogg"
  ".oga" = "audio/ogg"
  ".m4a" = "audio/mp4"
  ".mp4" = "audio/mp4"
  ".aac" = "audio/aac"
  ".flac" = "audio/flac"
  ".opus" = "audio/opus"
  ".webm" = "audio/webm"
  ".weba" = "audio/webm"
  ".aif" = "audio/aiff"
  ".aiff" = "audio/aiff"
  ".caf" = "audio/x-caf"
  ".wma" = "audio/x-ms-wma"
  ".mid" = "audio/midi"
  ".midi" = "audio/midi"
}

function Get-RelativeAssetFiles {
  param(
    [string]$Directory,
    [string[]]$Extensions
  )

  if (!(Test-Path -LiteralPath $Directory)) {
    return @()
  }

  return @(Get-ChildItem -LiteralPath $Directory -File -Recurse |
    Where-Object { $Extensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object FullName |
    ForEach-Object {
      $relative = $_.FullName.Substring($root.Length).TrimStart("\", "/").Replace("\", "/")
      "../$relative"
    })
}

function New-Manifest {
  $manifest = [ordered]@{
    music = [ordered]@{}
    sfx = [ordered]@{}
    sprites = [ordered]@{}
  }

  foreach ($group in $musicGroups) {
    $manifest.music[$group] = [object[]]@(Get-RelativeAssetFiles (Join-Path $assets "music\$group") $audioExts)
  }
  foreach ($group in $sfxGroups) {
    $manifest.sfx[$group] = [object[]]@(Get-RelativeAssetFiles (Join-Path $assets "sfx\$group") $audioExts)
  }
  foreach ($group in $spriteGroups) {
    $manifest.sprites[$group] = [object[]]@(Get-RelativeAssetFiles (Join-Path $assets "sprites\$group") $imageExts)
  }

  return $manifest
}

function Send-Text {
  param($Response, [int]$Status, [string]$Text, [string]$ContentType)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $Response.StatusCode = $Status
  $Response.ContentType = $ContentType
  $Response.Headers.Set("Cache-Control", "no-store")
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Send-File {
  param($Response, [string]$File)
  $bytes = [System.IO.File]::ReadAllBytes($File)
  $ext = [System.IO.Path]::GetExtension($File).ToLowerInvariant()
  $Response.StatusCode = 200
  $Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
  $Response.Headers.Set("Cache-Control", "no-store")
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

$listener = [System.Net.HttpListener]::new()
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Don Bosco Zombie Invasion running at $prefix"
Write-Host "Press Ctrl+C to stop."

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestPath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)

    try {
      if ($requestPath -eq "/assets/manifest.json") {
        $json = New-Manifest | ConvertTo-Json -Depth 8
        Send-Text $context.Response 200 $json "application/json; charset=utf-8"
      } elseif ($requestPath -eq "/assets/manifest.js") {
        $json = New-Manifest | ConvertTo-Json -Depth 8
        Send-Text $context.Response 200 "window.DBZ_ASSET_MANIFEST = $json;" "text/javascript; charset=utf-8"
      } else {
        if ($requestPath -eq "/") { $requestPath = "/don_bosco_zombie_invasion2.html" }
        $relative = $requestPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
        $file = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
        $insideRoot = $file.Equals($root, [System.StringComparison]::OrdinalIgnoreCase) -or $file.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)

        if (!$insideRoot) {
          Send-Text $context.Response 403 "Forbidden" "text/plain; charset=utf-8"
        } elseif (!(Test-Path -LiteralPath $file -PathType Leaf)) {
          Send-Text $context.Response 404 "Not found" "text/plain; charset=utf-8"
        } else {
          Send-File $context.Response $file
        }
      }
    } catch {
      Send-Text $context.Response 500 $_.Exception.Message "text/plain; charset=utf-8"
    } finally {
      $context.Response.Close()
    }
  }
} finally {
  $listener.Stop()
}
