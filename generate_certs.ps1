# generate_certs.ps1
# Generates self-signed SSL certificates for localhost / 127.0.0.1 for local HTTPS testing.

$certsDir = Join-Path $PSScriptRoot "certs"
if (!(Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir | Out-Null
}

$certFile = Join-Path $certsDir "cert.pem"
$keyFile = Join-Path $certsDir "key.pem"

Write-Host "Generating self-signed SSL certificate for localhost..." -ForegroundColor Cyan

openssl req -x509 -newkey rsa:2048 -keyout $keyFile -out $certFile -sha256 -days 365 -nodes -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

if ((Test-Path $certFile) -and (Test-Path $keyFile)) {
    Write-Host "SSL certificates successfully generated in $certsDir" -ForegroundColor Green
} else {
    Write-Host "Failed to generate SSL certificates. Please ensure OpenSSL is installed and accessible in your PATH." -ForegroundColor Red
}
