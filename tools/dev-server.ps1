param([int]$Port = 8642)

# Minimal static file server (no Node/Python required).
# Serves the repo root at http://localhost:$Port/
$root = Split-Path -Parent $PSScriptRoot

$mime = @{
  ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8"
  ".css"="text/css; charset=utf-8";   ".js"="text/javascript; charset=utf-8"
  ".json"="application/json";         ".svg"="image/svg+xml"
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"
  ".ico"="image/x-icon"; ".pdf"="application/pdf"; ".csv"="text/csv"
  ".woff"="font/woff"; ".woff2"="font/woff2"; ".txt"="text/plain; charset=utf-8"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/"

while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath) -replace '/', '\'
    if ($rel -eq '\') { $rel = '\index.html' }
    $path = Join-Path $root $rel.TrimStart('\')
    $full = [System.IO.Path]::GetFullPath($path)
    if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
    } elseif ((Test-Path $full -PathType Container) -and (Test-Path (Join-Path $full 'index.html'))) {
      $bytes = [System.IO.File]::ReadAllBytes((Join-Path $full 'index.html'))
      $res.ContentType = $mime[".html"]
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } elseif (Test-Path $full -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - not found")
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.OutputStream.Close() } catch {}
  }
}
