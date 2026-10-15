# generate_certs.ps1
# Generates self-signed SSL certificates for localhost / 127.0.0.1 for local HTTPS testing.

$certsDir = Join-Path $PSScriptRoot "certs"
if (!(Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir | Out-Null
}

$certFile = Join-Path $certsDir "cert.pem"
$keyFile  = Join-Path $certsDir "key.pem"

Write-Host "Locating OpenSSL..." -ForegroundColor Cyan

# 1. Check if openssl is directly accessible in PATH
$opensslCmd = Get-Command "openssl" -ErrorAction SilentlyContinue
$opensslPath = if ($opensslCmd) { $opensslCmd.Source } else { $null }

# 2. Check if Git for Windows has bundled openssl.exe
if (-not $opensslPath) {
    $gitCmd = Get-Command "git" -ErrorAction SilentlyContinue
    if ($gitCmd) {
        $gitDir = Split-Path (Split-Path $gitCmd.Source)
        $gitOpenSsl = Join-Path $gitDir "usr\bin\openssl.exe"
        if (Test-Path $gitOpenSsl) {
            $opensslPath = $gitOpenSsl
        }
    }
}

# 3. Check common standard installation locations on Windows
if (-not $opensslPath) {
    $commonPaths = @(
        "C:\Program Files\Git\usr\bin\openssl.exe",
        "C:\Program Files (x86)\Git\usr\bin\openssl.exe",
        (Join-Path $env:LOCALAPPDATA "Programs\Git\usr\bin\openssl.exe"),
        "C:\OpenSSL-Win64\bin\openssl.exe",
        "C:\OpenSSL-Win32\bin\openssl.exe",
        "C:\msys64\mingw64\bin\openssl.exe"
    )
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $opensslPath = $path
            break
        }
    }
}

if ($opensslPath) {
    Write-Host "Found OpenSSL at: $opensslPath" -ForegroundColor Green
    Write-Host "Generating self-signed SSL certificate for localhost and 127.0.0.1..." -ForegroundColor Cyan
    
    & $opensslPath req -x509 -newkey rsa:2048 -keyout $keyFile -out $certFile -sha256 -days 365 -nodes -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
} else {
    Write-Host "ERROR: OpenSSL was not found in PATH or Git installation." -ForegroundColor Red
    Write-Host "Please ensure Git for Windows is installed (which includes openssl in its usr\bin directory)." -ForegroundColor Yellow
}

if ((Test-Path $certFile) -and (Test-Path $keyFile)) {
    Write-Host "SSL certificates successfully verified in $certsDir" -ForegroundColor Green
} else {
    Write-Host "Failed to generate SSL certificates." -ForegroundColor Red
}
