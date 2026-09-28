$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$appUrl = 'http://127.0.0.1:3000/'

function Test-ThumbnailServer {
  try {
    $response = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 2
    return $response.Content.Contains('src="/app.js"')
  } catch {
    return $false
  }
}

try {
  if (-not (Test-ThumbnailServer)) {
    $node = (Get-Command node -ErrorAction Stop).Source
    $logDirectory = Join-Path $projectRoot '.cache'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

    $server = Start-Process -FilePath $node -ArgumentList 'server.mjs' `
      -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput (Join-Path $logDirectory 'server.stdout.log') `
      -RedirectStandardError (Join-Path $logDirectory 'server.stderr.log')

    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
      Start-Sleep -Milliseconds 250
      if (Test-ThumbnailServer) {
        $ready = $true
        break
      }
      if ($server.HasExited) { break }
    }
    if (-not $ready) {
      throw 'The server could not start on port 3000. Check .cache/server.stderr.log.'
    }
  }

  Start-Process $appUrl
} catch {
  $shell = New-Object -ComObject WScript.Shell
  $shell.Popup($_.Exception.Message, 0, 'LoL Thumbnail Studio', 0x10) | Out-Null
  exit 1
}
