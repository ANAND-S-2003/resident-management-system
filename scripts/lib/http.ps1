function Initialize-SmokeHttpClient {
    if ($null -eq $script:SmokeHttpClient) {
        Add-Type -AssemblyName System.Net.Http -ErrorAction Stop
        $script:SmokeHttpClient = [System.Net.Http.HttpClient]::new()
        $script:SmokeHttpClient.Timeout = [TimeSpan]::FromSeconds(30)
    }
}

function Close-SmokeHttpClient {
    if ($null -ne $script:SmokeHttpClient) {
        $script:SmokeHttpClient.Dispose()
        $script:SmokeHttpClient = $null
    }
}

function Get-SafeResponseText {
    param([AllowNull()][string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return "<empty>"
    }

    $safe = $Text -replace '(?i)("(?:accessToken|token|password|passwordHash|password_hash|jwtSecret|currentPassword|newPassword)"\s*:\s*")[^"]*(")', '$1[REDACTED]$2'
    foreach ($secret in @($script:SmokeSensitiveValues)) {
        if (-not [string]::IsNullOrEmpty([string]$secret)) {
            $safe = $safe.Replace([string]$secret, "[REDACTED]")
        }
    }
    $safe = $safe.Trim()
    if ($safe.Length -gt 300) {
        $safe = $safe.Substring(0, 297) + "..."
    }
    return $safe
}

function Format-LastApiDiagnostic {
    if ($null -eq $script:LastApiResponse) {
        return "HTTP status=<none>; response body=<none>"
    }
    $raw = Get-SafeResponseText $script:LastApiResponse.RawBody
    return ("HTTP {0} {1} {2}; response body: {3}" -f $script:LastApiResponse.StatusCode,
        $script:LastApiResponse.Method, $script:LastApiResponse.Path, $raw)
}

function Invoke-Api {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        [AllowNull()][string]$Body,
        [AllowNull()][string]$Token
    )

    Initialize-SmokeHttpClient
    $script:LastApiResponse = $null
    $message = $null
    $response = $null
    try {
        $httpMethod = [System.Net.Http.HttpMethod]::new($Method)
        $uri = [Uri]($script:BaseUrl + $Path)
        $message = [System.Net.Http.HttpRequestMessage]::new($httpMethod, $uri)

        if (-not [string]::IsNullOrWhiteSpace($Token)) {
            $message.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $Token)
        }
        # Never attach entity content to GET/HEAD: HttpWebRequest on Windows PowerShell 5.1
        # rejects content with those verbs, and these API reads have no request body.
        if ($Method -notin @("GET", "HEAD") -and $null -ne $Body) {
            $message.Content = [System.Net.Http.StringContent]::new($Body, [System.Text.Encoding]::UTF8, "application/json")
        }

        $response = $script:SmokeHttpClient.SendAsync($message).GetAwaiter().GetResult()
        $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
        $rawBody = [System.Text.Encoding]::UTF8.GetString($bytes)
        $status = [int]$response.StatusCode
        $script:LastApiResponse = [PSCustomObject]@{
            StatusCode = $status
            Method = $Method
            Path = $Path
            RawBody = $rawBody
        }

        $parsedBody = $null
        if (-not [string]::IsNullOrWhiteSpace($rawBody)) {
            try {
                $parsedBody = ConvertFrom-Json -InputObject $rawBody -ErrorAction Stop
            }
            catch {
                throw ("Response was not valid JSON; " + (Format-LastApiDiagnostic))
            }
        }

        return [PSCustomObject]@{
            StatusCode = $status
            Body = $parsedBody
            RawBody = $rawBody
            Headers = $response.Headers
            Method = $Method
            Path = $Path
        }
    }
    catch {
        if ($null -eq $script:LastApiResponse -or $script:LastApiResponse.Method -ne $Method -or $script:LastApiResponse.Path -ne $Path) {
            $script:LastApiResponse = [PSCustomObject]@{
                StatusCode = "<no response>"
                Method = $Method
                Path = $Path
                RawBody = ""
            }
        }
        $rootMessage = $_.Exception.GetBaseException().Message
        throw ("HTTP request failed; " + $rootMessage + "; " + (Format-LastApiDiagnostic))
    }
    finally {
        if ($null -ne $response) { $response.Dispose() }
        if ($null -ne $message) { $message.Dispose() }
    }
}
