$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib/http.ps1")

$listener = $null
$worker = $null
$runspace = $null
$ready = New-Object System.Threading.ManualResetEvent($false)
$control = @{ Listener = $null }
$failures = New-Object System.Collections.Generic.List[string]
$portFinder = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
try {
    $portFinder.Start()
    $port = ([System.Net.IPEndPoint]$portFinder.LocalEndpoint).Port
}
finally {
    $portFinder.Stop()
}
$prefix = "http://127.0.0.1:$port/"
$script:BaseUrl = "http://127.0.0.1:$port"
$script:SmokeHttpClient = $null
$script:LastApiResponse = $null
$script:SmokeSensitiveValues = @()

function Add-SelfTestFailure {
    param([string]$Message)
    $failures.Add($Message)
}

function Assert-SelfTest {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { Add-SelfTestFailure ($Message + " | " + (Format-LastApiDiagnostic)) }
}

try {
    $runspace = [RunspaceFactory]::CreateRunspace()
    $runspace.Open()
    $worker = [PowerShell]::Create()
    $worker.Runspace = $runspace
    $null = $worker.AddScript({
        param($ListenPrefix, $ReadyEvent, $SharedControl)
        $httpListener = New-Object System.Net.HttpListener
        $httpListener.Prefixes.Add($ListenPrefix)
        $httpListener.Start()
        $SharedControl.Listener = $httpListener
        $ReadyEvent.Set() | Out-Null
        try {
            for ($index = 0; $index -lt 6; $index++) {
                $context = $httpListener.GetContext()
                $reader = New-Object System.IO.StreamReader($context.Request.InputStream, [System.Text.Encoding]::UTF8)
                try { $requestBody = $reader.ReadToEnd() } finally { $reader.Dispose() }
                $authorization = $context.Request.Headers["Authorization"]
                $responseText = ""
                $statusCode = 200
                switch -Exact ($context.Request.Url.AbsolutePath) {
                    "/ok" {
                        $responseText = '{"status":"UP"}'
                    }
                    "/echo-headers" {
                        $payload = @{
                            bodyPresent = ($context.Request.HasEntityBody -or -not [string]::IsNullOrEmpty($requestBody))
                            authorizationPresent = -not [string]::IsNullOrEmpty($authorization)
                            contentType = $context.Request.ContentType
                        }
                        $responseText = ConvertTo-Json -InputObject $payload -Compress
                    }
                    "/echo" {
                        $responseText = $requestBody
                    }
                    "/unauth" {
                        $statusCode = 401
                        $responseText = '{"code":"UNAUTHENTICATED"}'
                    }
                    "/empty" {
                        $statusCode = 204
                        $responseText = ""
                    }
                }
                $response = $context.Response
                $response.StatusCode = $statusCode
                if ($statusCode -ne 204) {
                    $response.ContentType = "application/json; charset=utf-8"
                    $responseBytes = [System.Text.Encoding]::UTF8.GetBytes($responseText)
                    $response.ContentLength64 = $responseBytes.Length
                    $response.OutputStream.Write($responseBytes, 0, $responseBytes.Length)
                }
                $response.Close()
            }
        }
        finally {
            $httpListener.Close()
        }
    }).AddArgument($prefix).AddArgument($ready).AddArgument($control)
    $async = $worker.BeginInvoke()
    if (-not $ready.WaitOne(5000)) { throw "Fake HTTP listener did not start within five seconds." }

    Initialize-SmokeHttpClient

    $ok = Invoke-Api -Method GET -Path "/ok"
    Assert-SelfTest ($ok.StatusCode -eq 200 -and $ok.Body.status -eq "UP") "GET /ok did not return 200 JSON."

    $headers = Invoke-Api -Method GET -Path "/echo-headers" -Token "selftest-bearer-token"
    Assert-SelfTest ($headers.StatusCode -eq 200) "GET /echo-headers did not return 200."
    Assert-SelfTest ($headers.Body.bodyPresent -eq $false) "GET unexpectedly sent request content."
    Assert-SelfTest ($headers.Body.authorizationPresent -eq $true) "Authorization bearer header was not sent."
    Assert-SelfTest ([string]::IsNullOrEmpty([string]$headers.Body.contentType)) "GET unexpectedly sent a Content-Type header."

    $utf8Text = "utf8-" + [char]0x2713
    $postBody = ConvertTo-Json -InputObject @{ verb = "POST"; text = $utf8Text } -Compress
    $post = Invoke-Api -Method POST -Path "/echo" -Body $postBody
    Assert-SelfTest ($post.StatusCode -eq 200 -and $post.Body.verb -eq "POST" -and $post.Body.text -eq $utf8Text) "POST JSON body did not round-trip as UTF-8."

    $patch = Invoke-Api -Method PATCH -Path "/echo" -Body '{"verb":"PATCH"}'
    Assert-SelfTest ($patch.StatusCode -eq 200 -and $patch.Body.verb -eq "PATCH") "PATCH JSON body did not round-trip."

    $unauthorized = Invoke-Api -Method GET -Path "/unauth"
    Assert-SelfTest ($unauthorized.StatusCode -eq 401 -and $unauthorized.Body.code -eq "UNAUTHENTICATED") "401 JSON response threw or was parsed incorrectly."

    $empty = Invoke-Api -Method GET -Path "/empty"
    Assert-SelfTest ($empty.StatusCode -eq 204 -and $null -eq $empty.Body -and [string]::IsNullOrEmpty($empty.RawBody)) "204 empty response was not returned as a null body."

    if ($failures.Count -gt 0) {
        foreach ($failure in $failures) { Write-Host ("FAIL  " + $failure) -ForegroundColor Red }
        Write-Host ("Self-test summary: 0 passed, {0} failed." -f $failures.Count) -ForegroundColor Red
        exit 1
    }
    Write-Host "PASS  GET has no body or Content-Type and bearer auth is sent" -ForegroundColor Green
    Write-Host "PASS  POST and PATCH send UTF-8 JSON bodies" -ForegroundColor Green
    Write-Host "PASS  401 JSON and empty 204 are returned without throwing" -ForegroundColor Green
    Write-Host "Self-test summary: 3 passed, 0 failed." -ForegroundColor Green
}
catch {
    Write-Host ("FAIL  Self-test setup/request: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
finally {
    Close-SmokeHttpClient
    if ($null -ne $control.Listener) {
        try { $control.Listener.Stop() } catch { }
        try { $control.Listener.Close() } catch { }
    }
    if ($null -ne $worker) {
        try { $worker.Dispose() } catch { }
    }
    if ($null -ne $runspace) {
        try { $runspace.Close() } catch { }
        try { $runspace.Dispose() } catch { }
    }
    try { $ready.Dispose() } catch { }
}
