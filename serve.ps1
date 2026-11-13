param([int]$Port = 8080, [switch]$OpenBrowser)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$rootPrefix = [IO.Path]::GetFullPath($root) + [IO.Path]::DirectorySeparatorChar
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'; '.json' = 'application/json'
  '.png' = 'image/png'; '.ico' = 'image/x-icon'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'; '.glb' = 'model/gltf-binary'; '.gltf' = 'model/gltf+json'
  '.mp3' = 'audio/mpeg'; '.zip' = 'application/zip'
}

function Send-Headers($Stream, [string]$Status, [long]$Length = 0, [string]$Type = 'application/octet-stream') {
  $headers = "HTTP/1.1 $Status`r`nContent-Length: $Length`r`nContent-Type: $Type`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $bytes = [Text.Encoding]::ASCII.GetBytes($headers)
  $Stream.Write($bytes, 0, $bytes.Length)
}

function Send-FileResponse($Client) {
  $Client.ReceiveTimeout = 3000
  $Client.SendTimeout = 15000
  $stream = $Client.GetStream()
  $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
  try {
    $line = $reader.ReadLine()
    if (!$line) { return }
    if ($line -notmatch '^(\S+) (/\S*) HTTP/1\.[01]$') { Send-Headers $stream '400 Bad Request'; return }
    $method = $Matches[1]
    $target = $Matches[2]
    while ($reader.ReadLine()) {}  # Finish reading the browser's request headers.
    if ($method -notin 'GET','HEAD') { Send-Headers $stream '405 Method Not Allowed'; return }
    try {
      $relative = [Uri]::UnescapeDataString($target.Split('?')[0]).TrimStart('/')
      if (!$relative) { $relative = 'index.html' }
      $full = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $relative))
    } catch { Send-Headers $stream '400 Bad Request'; return }
    if (!$full.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or ![IO.File]::Exists($full)) {
      Send-Headers $stream '404 Not Found'
      return
    }
    try { $file = [IO.File]::OpenRead($full) }
    catch [UnauthorizedAccessException] { Send-Headers $stream '403 Forbidden'; return }
    catch [IO.IOException] { Send-Headers $stream '404 Not Found'; return }
    try {
      $type = $mime[[IO.Path]::GetExtension($full)]
      if (!$type) { $type = 'application/octet-stream' }
      Send-Headers $stream '200 OK' $file.Length $type
      if ($method -eq 'GET') { $file.CopyTo($stream) }
    } finally { $file.Dispose() }
  } finally { $reader.Dispose() }
}

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$listener.Start()
$clients = [Collections.Generic.List[Net.Sockets.TcpClient]]::new()
try {
  $url = "http://localhost:$Port/"
  Write-Host "LAST ZONE server running: $url  (stop: Ctrl+C)"
  if ($OpenBrowser) { Start-Process $url }
  while ($true) {
    if ($clients.Count -eq 0) { $clients.Add($listener.AcceptTcpClient()) }
    while ($listener.Pending()) { $clients.Add($listener.AcceptTcpClient()) }
    # Browsers may preconnect without sending a request. Serve sockets that have data first.
    for ($i = $clients.Count - 1; $i -ge 0; $i--) {
      $client = $clients[$i]
      if (!$client.Client.Poll(0, [Net.Sockets.SelectMode]::SelectRead)) { continue }
      $clients.RemoveAt($i)
      try { Send-FileResponse $client }
      catch [IO.IOException] { }  # A browser may cancel an asset request.
      finally { $client.Dispose() }
    }
    if ($clients.Count) { Start-Sleep -Milliseconds 10 }
  }
} finally {
  foreach ($client in $clients) { $client.Dispose() }
  $listener.Stop()
}
