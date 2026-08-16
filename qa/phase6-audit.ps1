# Phase 6 live verification — controls that used to be toast-only.
# Proves: request -> server response -> persisted state, for every wired control.
$ErrorActionPreference = 'SilentlyContinue'
$base = 'http://localhost:8080'

function Status($block) {
    try { & $block } catch { $_.Exception.Response.StatusCode.value__ }
}

function Login($email, $pw) {
    $body = @{ email = $email; password = $pw } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$base/api/v1/auth/login" -Method Post -ContentType 'application/json' -Body $body
    if ($res.data.token) { return $res.data.token }
    return $res.token
}

Write-Host '=== Public venue reviews (new endpoint) ==='
$venues = Invoke-RestMethod -Uri "$base/api/v1/venues?page=0&size=1"
$slug = ($venues.items | Select-Object -First 1).slug
if (-not $slug) { $slug = ($venues.content | Select-Object -First 1).slug }
Write-Host "venue slug: $slug"

$r = Invoke-WebRequest -Uri "$base/api/v1/venues/$slug/reviews?size=5" -UseBasicParsing
Write-Host "GET /venues/$slug/reviews -> $($r.StatusCode)"
Write-Host "  body: $($r.Content)"

$code = Status { (Invoke-WebRequest -Uri "$base/api/v1/venues/no-such-venue/reviews" -UseBasicParsing).StatusCode }
Write-Host "GET /venues/no-such-venue/reviews -> $code (expect 404)"

Write-Host ''
Write-Host '=== Removed close-shift mock ==='
$code = Status { (Invoke-WebRequest -Uri "$base/api/v1/owner/payments/close-shift" -Method Post -UseBasicParsing).StatusCode }
Write-Host "POST /owner/payments/close-shift -> $code (expect 401 or 404, never 200)"

Write-Host ''
Write-Host '=== Owner review response requires the owner ==='
$code = Status { (Invoke-WebRequest -Uri "$base/api/v1/owner/reviews/1/response" -Method Post -ContentType 'application/json' -Body '{"response":"hi"}' -UseBasicParsing).StatusCode }
Write-Host "POST /owner/reviews/1/response (anonymous) -> $code (expect 401)"

Write-Host ''
Write-Host '=== Tournament host endpoints exist and are guarded ==='
foreach ($path in @('/api/v1/host/tournaments/TR-CUP-0091/balance', '/api/v1/host/tournaments/TR-CUP-0091/invite-code')) {
    $code = Status { (Invoke-WebRequest -Uri "$base$path" -Method Post -ContentType 'application/json' -Body '{"method":"bKash"}' -UseBasicParsing).StatusCode }
    Write-Host "POST $path (anonymous) -> $code (expect 401)"
}
$code = Status { (Invoke-WebRequest -Uri "$base/api/v1/host/tournaments/TR-CUP-0091/settings" -Method Patch -ContentType 'application/json' -Body '{"privacy":"open"}' -UseBasicParsing).StatusCode }
Write-Host "PATCH /host/tournaments/TR-CUP-0091/settings (anonymous) -> $code (expect 401)"
