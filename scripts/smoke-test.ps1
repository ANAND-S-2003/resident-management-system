param(
    [string]$BaseUrl = "http://localhost:8080"
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd('/')
$script:BaseUrl = $BaseUrl
$script:Passed = 0
$script:Failed = 0
$script:Skipped = 0
$script:Password = "SmokePass123"
$script:State = @{}
$script:SmokeHttpClient = $null
$script:LastApiResponse = $null
$script:SmokeSensitiveValues = @()
$script:StepStatus = @{}
$script:StepFailureRoot = @{}
$script:StateOwner = @{}
$script:StepDependencies = @{
    "Resident login and /auth/me identity" = @("Register resident and reject duplicate email ignoring case")
    "Resident can list the five seeded active services" = @("Resident login and /auth/me identity")
    "Resident is forbidden from user management, including an empty POST body" = @("Resident login and /auth/me identity")
    "Resident request validation and successful request creation" = @("Resident login and /auth/me identity", "Resident can list the five seeded active services")
    "Admin request filtering and valid/invalid status transitions" = @("Resident request validation and successful request creation", "Super admin login, admin creation, and SUPER_ADMIN creation rejection")
    "Resident history and notification read operations" = @("Admin request filtering and valid/invalid status transitions", "Resident login and /auth/me identity")
    "Second resident is isolated from the first resident's requests" = @("Resident request validation and successful request creation")
    "Dashboard role fields and counts agree with request filters" = @("Super admin login, admin creation, and SUPER_ADMIN creation rejection")
    "Anonymous contact submission and admin visibility" = @("Super admin login, admin creation, and SUPER_ADMIN creation rejection", "Resident login and /auth/me identity")
    "Admin deactivation blocks second resident and self-deactivation" = @("Super admin login, admin creation, and SUPER_ADMIN creation rejection", "Second resident is isolated from the first resident's requests")
}

. (Join-Path $PSScriptRoot "lib/http.ps1")

function Step {
    param([string]$Name, [scriptblock]$Assertions)

    $dependencies = @()
    if ($script:StepDependencies.ContainsKey($Name)) {
        $dependencies = @($script:StepDependencies[$Name])
    }
    foreach ($dependency in $dependencies) {
        if ($script:StepStatus[$dependency] -ne "PASS") {
            $root = $dependency
            if ($script:StepFailureRoot.ContainsKey($dependency)) { $root = $script:StepFailureRoot[$dependency] }
            $script:Skipped++
            $script:StepStatus[$Name] = "SKIP"
            $script:StepFailureRoot[$Name] = $root
            Write-Host ("SKIP  " + $Name + ": depends on a failed step (" + $root + ")") -ForegroundColor Yellow
            return
        }
    }

    $script:CurrentStep = $Name
    $script:LastApiResponse = $null
    try {
        & $Assertions
        $script:Passed++
        $script:StepStatus[$Name] = "PASS"
        Write-Host ("PASS  " + $Name) -ForegroundColor Green
    }
    catch {
        $failureMessage = $_.Exception.Message
        if ($failureMessage.StartsWith("SMOKE_SKIP|")) {
            $root = $failureMessage.Substring("SMOKE_SKIP|".Length)
            $script:Skipped++
            $script:StepStatus[$Name] = "SKIP"
            $script:StepFailureRoot[$Name] = $root
            Write-Host ("SKIP  " + $Name + ": depends on a failed step (" + $root + ")") -ForegroundColor Yellow
            return
        }
        $script:Failed++
        $script:StepStatus[$Name] = "FAIL"
        $script:StepFailureRoot[$Name] = $Name
        Write-Host ("FAIL  " + $Name + ": " + $failureMessage + " | " + (Format-LastApiDiagnostic)) -ForegroundColor Red
    }
}

function Assert-Status {
    param($Response, [int]$Expected)

    if ($null -eq $Response) {
        throw "No HTTP response was returned."
    }
    if ([int]$Response.StatusCode -ne $Expected) {
        $code = "none"
        if ($null -ne $Response.Body -and $null -ne $Response.Body.code) {
            $code = [string]$Response.Body.code
        }
        throw ("Expected HTTP {0}, got {1} (error code: {2})." -f $Expected, $Response.StatusCode, $code)
    }
}

function Assert-Field {
    param($Object, [string]$Field, $Expected)

    if ($null -eq $Object -or $null -eq $Object.PSObject.Properties[$Field]) {
        throw ("Response is missing field '{0}'." -f $Field)
    }
    if ($Object.$Field -ne $Expected) {
        throw ("Response field '{0}' did not have the expected value." -f $Field)
    }
}

function Assert-NonEmpty {
    param($Value, [string]$Description)

    if ([string]::IsNullOrWhiteSpace([string]$Value)) {
        throw ("Expected {0} to be present." -f $Description)
    }
}

function Require-State {
    param([string]$Name)

    if (-not $script:State.ContainsKey($Name) -or $null -eq $script:State[$Name]) {
        $root = "an earlier step"
        if ($script:StateOwner.ContainsKey($Name)) { $root = $script:StateOwner[$Name] }
        throw ("SMOKE_SKIP|{0}" -f $root)
    }
    if ($script:StateOwner.ContainsKey($Name) -and $script:StepStatus[$script:StateOwner[$Name]] -ne "PASS") {
        $root = $script:StateOwner[$Name]
        if ($script:StepFailureRoot.ContainsKey($root)) { $root = $script:StepFailureRoot[$root] }
        throw ("SMOKE_SKIP|{0}" -f $root)
    }
    return $script:State[$Name]
}

function Set-SmokeState {
    param([string]$Name, $Value)
    $script:State[$Name] = $Value
    $script:StateOwner[$Name] = $script:CurrentStep
}

function Get-ApplicationDate {
    $zoneName = $env:RMS_TIMEZONE
    if ([string]::IsNullOrWhiteSpace($zoneName)) {
        $zoneName = "Asia/Kolkata"
    }
    # Windows PowerShell 5.1/.NET Framework uses Windows time-zone IDs.
    if ($zoneName -eq "Asia/Kolkata") {
        $zoneName = "India Standard Time"
    }
    try {
        $zone = [System.TimeZoneInfo]::FindSystemTimeZoneById($zoneName)
    }
    catch {
        throw ("RMS_TIMEZONE could not be resolved by this Windows PowerShell installation. Use an available Windows time-zone ID for this smoke run.")
    }
    return [System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $zone).Date
}

function Get-JsonBody {
    param([hashtable]$Values)
    return (ConvertTo-Json -InputObject $Values -Compress -Depth 10)
}

if ([string]::IsNullOrWhiteSpace($env:RMS_SUPERADMIN_EMAIL) -or
    [string]::IsNullOrWhiteSpace($env:RMS_SUPERADMIN_PASSWORD)) {
    Write-Host "RMS_SUPERADMIN_EMAIL and RMS_SUPERADMIN_PASSWORD are required. Run . .\scripts\load-env.ps1 first." -ForegroundColor Red
    exit 1
}
$script:SmokeSensitiveValues = @($script:Password, $env:RMS_SUPERADMIN_PASSWORD, "invalid-smoke-token")

$suffix = (Get-Date -Format "yyyyMMddHHmmss") + "-" + [Guid]::NewGuid().ToString("N").Substring(0, 6)
$residentEmail = "smoke-resident-$suffix@example.test"
$residentName = "Smoke Resident $suffix"
$residentFlat = "S-" + [Guid]::NewGuid().ToString("N").Substring(0, 8)
$residentBody = Get-JsonBody @{ fullName = $residentName; email = $residentEmail; password = $script:Password; flatNumber = $residentFlat }
$applicationToday = Get-ApplicationDate
$validExpectedDate = $applicationToday.AddDays(7).ToString("yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
$pastExpectedDate = "2000-01-01"

Step "GET /actuator/health reports UP" {
    $response = Invoke-Api -Method GET -Path "/actuator/health"
    Assert-Status $response 200
    Assert-Field $response.Body "status" "UP"
    if (@($response.Body.PSObject.Properties.Name).Count -ne 1) {
        throw "Health response included unexpected fields."
    }
}

Step "Anonymous authentication and user-list requests are rejected" {
    $authMe = Invoke-Api -Method GET -Path "/api/v1/auth/me"
    Assert-Status $authMe 401
    Assert-Field $authMe.Body "code" "UNAUTHENTICATED"
    $users = Invoke-Api -Method GET -Path "/api/v1/users"
    Assert-Status $users 401
    Assert-Field $users.Body "code" "UNAUTHENTICATED"
}

Step "Register resident and reject duplicate email ignoring case" {
    $response = Invoke-Api -Method POST -Path "/api/v1/auth/register" -Body $residentBody
    Assert-Status $response 201
    Assert-Field $response.Body "role" "USER"
    Assert-Field $response.Body "email" $residentEmail
    Assert-Field $response.Body "flatNumber" $residentFlat
    if ($response.Body.PSObject.Properties.Name -contains "password" -or
        $response.Body.PSObject.Properties.Name -contains "passwordHash" -or
        $response.Body.PSObject.Properties.Name -contains "password_hash") {
        throw "Registration response exposed a password field."
    }
    Set-SmokeState "ResidentId" $response.Body.id

    $duplicate = Get-JsonBody @{ fullName = $residentName; email = $residentEmail.ToUpperInvariant(); password = $script:Password; flatNumber = $residentFlat }
    $duplicateResponse = Invoke-Api -Method POST -Path "/api/v1/auth/register" -Body $duplicate
    Assert-Status $duplicateResponse 409
    Assert-Field $duplicateResponse.Body "code" "DUPLICATE_RESOURCE"
}

Step "Wrong and unknown login credentials have the same error" {
    $wrong = Invoke-Api -Method POST -Path "/api/v1/auth/login" -Body (Get-JsonBody @{ email = $residentEmail; password = "WrongSmoke123" })
    Assert-Status $wrong 401
    Assert-Field $wrong.Body "code" "INVALID_CREDENTIALS"

    $unknown = Invoke-Api -Method POST -Path "/api/v1/auth/login" -Body (Get-JsonBody @{ email = "unknown-$suffix@example.test"; password = "WrongSmoke123" })
    Assert-Status $unknown 401
    Assert-Field $unknown.Body "code" "INVALID_CREDENTIALS"
    if ($wrong.Body.message -ne $unknown.Body.message) {
        throw "Unknown-email and wrong-password messages differed."
    }
}

Step "Resident login and /auth/me identity" {
    $response = Invoke-Api -Method POST -Path "/api/v1/auth/login" -Body (Get-JsonBody @{ email = $residentEmail; password = $script:Password })
    Assert-Status $response 200
    Assert-NonEmpty $response.Body.accessToken "resident access token"
    Assert-Field $response.Body "tokenType" "Bearer"
    Set-SmokeState "ResidentToken" $response.Body.accessToken
    $script:SmokeSensitiveValues += $response.Body.accessToken

    $me = Invoke-Api -Method GET -Path "/api/v1/auth/me" -Token $script:State.ResidentToken
    Assert-Status $me 200
    if ($me.Body.id -ne $script:State.ResidentId) {
        throw "The authenticated user did not match the registered resident."
    }
    Assert-Field $me.Body "role" "USER"
}

Step "Resident can list the five seeded active services" {
    $residentToken = Require-State "ResidentToken"
    $requiredNames = @("Plumbing", "Electrical", "Cleaning", "Painting", "Internet Repair")
    foreach ($name in $requiredNames) {
        $encodedName = [Uri]::EscapeDataString($name)
        $response = Invoke-Api -Method GET -Path ("/api/v1/services?q={0}&size=100" -f $encodedName) -Token $residentToken
        Assert-Status $response 200
        $serviceItems = @($response.Body.content)
        $match = $serviceItems | Where-Object { $_.name -eq $name -and $_.active -eq $true } | Select-Object -First 1
        if ($null -eq $match) {
            throw ("The active seeded service '{0}' was not in the response." -f $name)
        }
        if ($name -eq "Plumbing") { Set-SmokeState "ServiceId" $match.id }
    }
}

Step "Resident is forbidden from user management, including an empty POST body" {
    $list = Invoke-Api -Method GET -Path "/api/v1/users" -Token (Require-State "ResidentToken")
    Assert-Status $list 403
    Assert-Field $list.Body "code" "FORBIDDEN"
    $create = Invoke-Api -Method POST -Path "/api/v1/users" -Body "" -Token $script:State.ResidentToken
    Assert-Status $create 403
    Assert-Field $create.Body "code" "FORBIDDEN"
}

Step "Resident request validation and successful request creation" {
    $serviceId = Require-State "ServiceId"
    $pastBody = Get-JsonBody @{ serviceId = $serviceId; description = "Smoke test plumbing request"; expectedCompletionDate = $pastExpectedDate }
    $past = Invoke-Api -Method POST -Path "/api/v1/requests" -Body $pastBody -Token (Require-State "ResidentToken")
    Assert-Status $past 400
    Assert-Field $past.Body "code" "VALIDATION_ERROR"

    $validBody = Get-JsonBody @{ serviceId = $serviceId; description = "Smoke test plumbing request"; expectedCompletionDate = $validExpectedDate }
    $created = Invoke-Api -Method POST -Path "/api/v1/requests" -Body $validBody -Token $script:State.ResidentToken
    Assert-Status $created 201
    Assert-Field $created.Body "status" "PENDING"
    Assert-Field $created.Body "overdue" $false
    Assert-Field $created.Body "flatNumber" $residentFlat
    Assert-NonEmpty $created.Body.id "request id"
    Set-SmokeState "RequestId" $created.Body.id
}

Step "Super admin login, admin creation, and SUPER_ADMIN creation rejection" {
    $superLogin = Invoke-Api -Method POST -Path "/api/v1/auth/login" -Body (Get-JsonBody @{ email = $env:RMS_SUPERADMIN_EMAIL; password = $env:RMS_SUPERADMIN_PASSWORD })
    Assert-Status $superLogin 200
    Assert-NonEmpty $superLogin.Body.accessToken "super admin access token"
    Set-SmokeState "SuperAdminToken" $superLogin.Body.accessToken
    $script:SmokeSensitiveValues += $superLogin.Body.accessToken

    $adminEmail = "smoke-admin-$suffix@example.test"
    $adminName = "Smoke Admin $suffix"
    $adminBody = Get-JsonBody @{ fullName = $adminName; email = $adminEmail; password = $script:Password; role = "ADMIN" }
    $adminCreated = Invoke-Api -Method POST -Path "/api/v1/users" -Body $adminBody -Token $script:State.SuperAdminToken
    Assert-Status $adminCreated 201
    Assert-Field $adminCreated.Body "role" "ADMIN"
    Assert-Field $adminCreated.Body "email" $adminEmail
    Set-SmokeState "AdminId" $adminCreated.Body.id
    Set-SmokeState "AdminEmail" $adminEmail

    $forbiddenBody = Get-JsonBody @{ fullName = "Forbidden Smoke"; email = "smoke-forbidden-$suffix@example.test"; password = $script:Password; role = "SUPER_ADMIN" }
    $forbidden = Invoke-Api -Method POST -Path "/api/v1/users" -Body $forbiddenBody -Token $script:State.SuperAdminToken
    Assert-Status $forbidden 403
    Assert-Field $forbidden.Body "code" "FORBIDDEN"

    $adminLogin = Invoke-Api -Method POST -Path "/api/v1/auth/login" -Body (Get-JsonBody @{ email = $adminEmail; password = $script:Password })
    Assert-Status $adminLogin 200
    Assert-NonEmpty $adminLogin.Body.accessToken "admin access token"
    Set-SmokeState "AdminToken" $adminLogin.Body.accessToken
    $script:SmokeSensitiveValues += $adminLogin.Body.accessToken
}

Step "Admin request filtering and valid/invalid status transitions" {
    $requestId = Require-State "RequestId"
    $adminToken = Require-State "AdminToken"
    $list = Invoke-Api -Method GET -Path "/api/v1/requests?status=PENDING&size=100" -Token $adminToken
    Assert-Status $list 200
    if (-not (@($list.Body.content) | Where-Object { $_.id -eq $requestId })) {
        throw "The pending request was not present in the admin request list."
    }

    $directComplete = Invoke-Api -Method PATCH -Path "/api/v1/requests/$requestId" -Body '{"status":"COMPLETED"}' -Token $adminToken
    Assert-Status $directComplete 409
    Assert-Field $directComplete.Body "code" "INVALID_STATUS_TRANSITION"
    $rejectWithoutRemarks = Invoke-Api -Method PATCH -Path "/api/v1/requests/$requestId" -Body '{"status":"REJECTED"}' -Token $adminToken
    Assert-Status $rejectWithoutRemarks 400
    Assert-Field $rejectWithoutRemarks.Body "code" "VALIDATION_ERROR"
    $inProgress = Invoke-Api -Method PATCH -Path "/api/v1/requests/$requestId" -Body '{"status":"IN_PROGRESS"}' -Token $adminToken
    Assert-Status $inProgress 200
    Assert-Field $inProgress.Body "status" "IN_PROGRESS"
    $completed = Invoke-Api -Method PATCH -Path "/api/v1/requests/$requestId" -Body '{"status":"COMPLETED"}' -Token $adminToken
    Assert-Status $completed 200
    Assert-Field $completed.Body "status" "COMPLETED"
    $reopened = Invoke-Api -Method PATCH -Path "/api/v1/requests/$requestId" -Body '{"status":"IN_PROGRESS"}' -Token $adminToken
    Assert-Status $reopened 409
    Assert-Field $reopened.Body "code" "INVALID_STATUS_TRANSITION"
}

Step "Resident history and notification read operations" {
    $requestId = Require-State "RequestId"
    $residentToken = Require-State "ResidentToken"
    $history = Invoke-Api -Method GET -Path "/api/v1/requests/$requestId/history" -Token $residentToken
    Assert-Status $history 200
    $entries = @($history.Body)
    if ($entries.Count -ne 3) { throw "Expected three history entries for this request." }
    if ($null -ne $entries[0].fromStatus -or $entries[0].toStatus -ne "PENDING" -or
        $entries[1].fromStatus -ne "PENDING" -or $entries[1].toStatus -ne "IN_PROGRESS" -or
        $entries[2].fromStatus -ne "IN_PROGRESS" -or $entries[2].toStatus -ne "COMPLETED") {
        throw "Request history did not contain the expected ordered transitions."
    }

    $notifications = Invoke-Api -Method GET -Path "/api/v1/notifications?unreadOnly=true&size=100" -Token $residentToken
    Assert-Status $notifications 200
    $requestNotifications = @($notifications.Body.content | Where-Object { $_.requestId -eq $requestId -and $_.read -eq $false })
    if ($requestNotifications.Count -ne 2) { throw "Expected two unread notifications for this request." }
    $count = Invoke-Api -Method GET -Path "/api/v1/notifications/unread-count" -Token $residentToken
    Assert-Status $count 200
    Assert-Field $count.Body "count" 2

    $marked = Invoke-Api -Method PATCH -Path ("/api/v1/notifications/{0}/read" -f $requestNotifications[0].id) -Body '{"read":true}' -Token $residentToken
    Assert-Status $marked 200
    Assert-Field $marked.Body "read" $true
    $afterOne = Invoke-Api -Method GET -Path "/api/v1/notifications/unread-count" -Token $residentToken
    Assert-Status $afterOne 200
    Assert-Field $afterOne.Body "count" 1
    $readAll = Invoke-Api -Method PATCH -Path "/api/v1/notifications/read-all" -Token $residentToken
    Assert-Status $readAll 204
    $afterAll = Invoke-Api -Method GET -Path "/api/v1/notifications/unread-count" -Token $residentToken
    Assert-Status $afterAll 200
    Assert-Field $afterAll.Body "count" 0
}

Step "Second resident is isolated from the first resident's requests" {
    $secondEmail = "smoke-second-$suffix@example.test"
    $secondName = "Smoke Second $suffix"
    $secondFlat = "S-" + [Guid]::NewGuid().ToString("N").Substring(0, 8)
    $body = Get-JsonBody @{ fullName = $secondName; email = $secondEmail; password = $script:Password; flatNumber = $secondFlat }
    $created = Invoke-Api -Method POST -Path "/api/v1/auth/register" -Body $body
    Assert-Status $created 201
    Assert-Field $created.Body "role" "USER"
    Set-SmokeState "SecondResidentId" $created.Body.id
    $login = Invoke-Api -Method POST -Path "/api/v1/auth/login" -Body (Get-JsonBody @{ email = $secondEmail; password = $script:Password })
    Assert-Status $login 200
    Set-SmokeState "SecondResidentToken" $login.Body.accessToken
    $script:SmokeSensitiveValues += $login.Body.accessToken

    $requestId = Require-State "RequestId"
    $hidden = Invoke-Api -Method GET -Path "/api/v1/requests/$requestId" -Token $script:State.SecondResidentToken
    Assert-Status $hidden 404
    Assert-Field $hidden.Body "code" "NOT_FOUND"
    $list = Invoke-Api -Method GET -Path "/api/v1/requests" -Token $script:State.SecondResidentToken
    Assert-Status $list 200
    Assert-Field $list.Body "totalElements" 0
}

Step "Dashboard role fields and counts agree with request filters" {
    $adminToken = Require-State "AdminToken"
    $superToken = Require-State "SuperAdminToken"
    $admin = Invoke-Api -Method GET -Path "/api/v1/dashboard/summary" -Token $adminToken
    Assert-Status $admin 200
    $statuses = @("PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED")
    $sum = 0
    foreach ($statusName in $statuses) {
        if ($null -eq $admin.Body.byStatus.PSObject.Properties[$statusName]) { throw "Dashboard is missing status key $statusName." }
        $sum += [long]$admin.Body.byStatus.$statusName
        $filtered = Invoke-Api -Method GET -Path ("/api/v1/requests?status={0}&size=1" -f $statusName) -Token $adminToken
        Assert-Status $filtered 200
        if ([long]$filtered.Body.totalElements -ne [long]$admin.Body.byStatus.$statusName) {
            throw ("Dashboard count for {0} did not match its filtered request list." -f $statusName)
        }
    }
    if ($admin.Body.PSObject.Properties.Name -contains "activeAdmins") { throw "ADMIN dashboard unexpectedly included activeAdmins." }
    if ([long]$admin.Body.totalRequests -ne $sum) { throw "Dashboard totalRequests did not equal the status sum." }
    $overdue = Invoke-Api -Method GET -Path "/api/v1/requests?overdue=true&size=1" -Token $adminToken
    Assert-Status $overdue 200
    if ([long]$overdue.Body.totalElements -ne [long]$admin.Body.overdueCount) { throw "Dashboard overdueCount did not match the overdue request list." }

    $super = Invoke-Api -Method GET -Path "/api/v1/dashboard/summary" -Token $superToken
    Assert-Status $super 200
    Assert-NonEmpty $super.Body.activeAdmins "SUPER_ADMIN activeAdmins count"
    $superSum = 0
    foreach ($statusName in $statuses) {
        if ($null -eq $super.Body.byStatus.PSObject.Properties[$statusName]) { throw "SUPER_ADMIN dashboard is missing status key $statusName." }
        $superSum += [long]$super.Body.byStatus.$statusName
        $filtered = Invoke-Api -Method GET -Path ("/api/v1/requests?status={0}&size=1" -f $statusName) -Token $superToken
        Assert-Status $filtered 200
        if ([long]$filtered.Body.totalElements -ne [long]$super.Body.byStatus.$statusName) {
            throw ("SUPER_ADMIN dashboard count for {0} did not match its filtered request list." -f $statusName)
        }
    }
    if ([long]$super.Body.totalRequests -ne $superSum) { throw "SUPER_ADMIN totalRequests did not equal the status sum." }
    $superOverdue = Invoke-Api -Method GET -Path "/api/v1/requests?overdue=true&size=1" -Token $superToken
    Assert-Status $superOverdue 200
    if ([long]$superOverdue.Body.totalElements -ne [long]$super.Body.overdueCount) {
        throw "SUPER_ADMIN overdueCount did not match the overdue request list."
    }
}

Step "Anonymous contact submission and admin visibility" {
    $contactEmail = "smoke-contact-$suffix@example.test"
    $contactBody = Get-JsonBody @{ name = "Smoke Visitor $suffix"; email = $contactEmail; subject = "Smoke check"; message = "Smoke test contact message $suffix" }
    $created = Invoke-Api -Method POST -Path "/api/v1/contact-queries" -Body $contactBody
    Assert-Status $created 201
    Assert-NonEmpty $created.Body.id "contact query id"
    Set-SmokeState "ContactId" $created.Body.id

    $list = Invoke-Api -Method GET -Path "/api/v1/contact-queries?size=100" -Token (Require-State "AdminToken")
    Assert-Status $list 200
    if (-not (@($list.Body.content) | Where-Object { $_.id -eq $script:State.ContactId })) {
        throw "Admin contact-query list did not contain the submitted query."
    }
    $forbidden = Invoke-Api -Method GET -Path "/api/v1/contact-queries" -Token (Require-State "ResidentToken")
    Assert-Status $forbidden 403
    Assert-Field $forbidden.Body "code" "FORBIDDEN"
}

Step "Admin deactivation blocks second resident and self-deactivation" {
    $adminToken = Require-State "AdminToken"
    $secondId = Require-State "SecondResidentId"
    $deactivated = Invoke-Api -Method PATCH -Path "/api/v1/users/$secondId/activation" -Body '{"active":false}' -Token $adminToken
    Assert-Status $deactivated 200
    Assert-Field $deactivated.Body "active" $false
    $me = Invoke-Api -Method GET -Path "/api/v1/auth/me" -Token (Require-State "SecondResidentToken")
    Assert-Status $me 401
    Assert-Field $me.Body "code" "UNAUTHENTICATED"
    $login = Invoke-Api -Method POST -Path "/api/v1/auth/login" -Body (Get-JsonBody @{ email = "smoke-second-$suffix@example.test"; password = $script:Password })
    Assert-Status $login 401
    Assert-Field $login.Body "code" "INVALID_CREDENTIALS"
    $self = Invoke-Api -Method PATCH -Path ("/api/v1/users/{0}/activation" -f (Require-State "AdminId")) -Body '{"active":false}' -Token $adminToken
    Assert-Status $self 400
    Assert-Field $self.Body "code" "VALIDATION_ERROR"
}

Step "Invalid bearer token is rejected on public contact submission" {
    $body = Get-JsonBody @{ name = "Invalid Token Visitor"; email = "invalid-token-$suffix@example.test"; subject = "Smoke check"; message = "This request should be rejected" }
    $response = Invoke-Api -Method POST -Path "/api/v1/contact-queries" -Body $body -Token "invalid-smoke-token"
    Assert-Status $response 401
    if ($null -eq $response.Body -or $null -eq $response.Body.PSObject.Properties["code"]) {
        throw ("Expected error code UNAUTHENTICATED after HTTP 401; raw response body: {0}" -f (Get-SafeResponseText $response.RawBody))
    }
    if ($response.Body.code -ne "UNAUTHENTICATED") {
        throw ("Expected error code UNAUTHENTICATED after HTTP 401; raw response body: {0}" -f (Get-SafeResponseText $response.RawBody))
    }
}

Close-SmokeHttpClient
Write-Host ""
Write-Host ("Smoke test summary: {0} passed, {1} failed, {2} skipped." -f $script:Passed, $script:Failed, $script:Skipped)
if ($script:Failed -gt 0) {
    exit 1
}
