$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'load-env.ps1')
$env:RMS_RATE_LIMIT_REGISTER_MAX = '1000'
$env:RMS_RATE_LIMIT_LOGIN_MAX = '1000'
$env:RMS_RATE_LIMIT_CONTACT_MAX = '1000'

Push-Location (Join-Path $PSScriptRoot '..')
try {
    docker compose up -d db
    if ($LASTEXITCODE -ne 0) { throw 'Could not start the local database with Docker Compose.' }

    Push-Location (Join-Path (Get-Location) 'backend')
    try {
        mvn spring-boot:run
        if ($LASTEXITCODE -ne 0) { throw 'The backend stopped with an error.' }
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}
