$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8080'
$results = @()

function Call($method, $path, $body, $token, $contentType) {
    $h = @{}
    if ($token) { $h['Authorization'] = "Bearer $token" }
    $args = @{ Uri = "$base$path"; Method = $method; Headers = $h; UseBasicParsing = $true; TimeoutSec = 30 }
    if ($null -ne $body) {
        $args['ContentType'] = $(if ($contentType) { $contentType } else { 'application/json' })
        $args['Body'] = $(if ($body -is [string]) { $body } else { ($body | ConvertTo-Json -Depth 8) })
    }
    try {
        $r = Invoke-WebRequest @args
        return @{ status = [int]$r.StatusCode; body = $r.Content }
    }
    catch {
        $s = 0; $b = ''
        $resp = $_.Exception.Response
        if (-not $resp -and $_.Exception.InnerException) { $resp = $_.Exception.InnerException.Response }
        if ($resp) {
            $s = [int]$resp.StatusCode
            # PowerShell 5.1 may already have drained the stream; fall back to
            # the parsed error record, which carries the body for WebException.
            try {
                $stream = $resp.GetResponseStream()
                $stream.Position = 0
                $b = (New-Object System.IO.StreamReader($stream)).ReadToEnd()
            }
            catch { $b = '' }
        }
        if (-not $b -and $_.ErrorDetails -and $_.ErrorDetails.Message) { $b = $_.ErrorDetails.Message }
        if (-not $b) { $b = $_.Exception.Message }
        return @{ status = $s; body = $b }
    }
}

function Check($id, $desc, $expected, $actual, $extra) {
    $pass = ($expected -eq $actual)
    $script:results += [pscustomobject]@{
        id = $id; check = $desc; expected = $expected; actual = $actual; pass = $pass; note = "$extra"
    }
    $colour = $(if ($pass) { 'Green' } else { 'Red' })
    Write-Host ("  [{0}] {1,-58} expected {2}, got {3} {4}" -f $id, $desc, $expected, $actual, $extra) -ForegroundColor $colour
}

$stamp = [DateTime]::UtcNow.ToString('HHmmssfff')

Write-Host "`n== accounts ==" -ForegroundColor Yellow
$reg = Call POST '/api/v1/auth/register' @{
    fullName = 'Audit Player'; email = "audit$stamp@qa.test"; password = 'AuditPass@123'
    phone = "+880$(Get-Random -Minimum 100000000 -Maximum 999999999)"; role = 'PLAYER'
} $null
$player = ($reg.body | ConvertFrom-Json)
$pt = $player.token
Write-Host "  player id=$($player.user.id) status=$($reg.status)"

$adminLogin = Call POST '/api/v1/auth/login' @{ email = 'admin0@turfchai.com'; password = 'Demo@12345' } $null
# Prefer the gate's shared 2FA session; see run-qa.ps1.
$at = if ($env:QA_ADMIN_TOKEN) { $env:QA_ADMIN_TOKEN } else { ($adminLogin.body | ConvertFrom-Json).token }
Write-Host "  admin login=$($adminLogin.status)"

Write-Host "`n== TC-024 / error envelope ==" -ForegroundColor Yellow
$anon = Call GET '/api/v1/bookings' $null $null
Check 'TC-024a' 'anonymous protected route -> 401' 401 $anon.status
$hasEnvelope = $anon.body -match '"status"' -and $anon.body -match '"message"' -and $anon.body -match '"timestamp"'
Check 'TC-024b' '401 body carries the standard envelope' $true $hasEnvelope
$unrouted = Call GET '/api/v1/definitely-not-real' $null $pt
Check 'TC-024c' 'authenticated unrouted path -> 404' 404 $unrouted.status
$forbidden = Call GET '/api/v1/admin/turf-requests' $null $pt
Check 'TC-024d' 'wrong-role -> 403 with a body' 403 $forbidden.status
Check 'TC-024e' '403 body is not empty' $true ($forbidden.body -match '"message"')

Write-Host "`n== TC-025 unknown venue slots ==" -ForegroundColor Yellow
$badVenue = Call GET '/api/v1/venues/99999999/slots?date=2026-09-01' $null $null
Check 'TC-025' 'unknown venue slots -> 404' 404 $badVenue.status

Write-Host "`n== TC-009 / QA-N07 time authority ==" -ForegroundColor Yellow
$today = (Get-Date).ToString('yyyy-MM-dd')
$yesterday = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')
$ancient = Call GET "/api/v1/venues/1/slots?date=1999-01-01" $null $null
$ancientCount = (($ancient.body | ConvertFrom-Json) | Measure-Object).Count
Check 'QA-N07a' 'far-past date generates no slots' 0 $ancientCount
$farFuture = (Get-Date).AddYears(5).ToString('yyyy-MM-dd')
$ff = Call GET "/api/v1/venues/1/slots?date=$farFuture" $null $null
$ffCount = (($ff.body | ConvertFrom-Json) | Measure-Object).Count
Check 'QA-N07b' 'beyond-horizon date generates no slots' 0 $ffCount

$todaySlots = (Call GET "/api/v1/venues/1/slots?date=$today" $null $null).body | ConvertFrom-Json
$nowT = (Get-Date).ToString('HH:mm:ss')
$elapsed = @($todaySlots | Where-Object { $_.startTime -lt $nowT -and $_.status -eq 'AVAILABLE' })
if ($elapsed.Count -gt 0) {
    $anyBookable = @($elapsed | Where-Object { $_.bookable }).Count
    Check 'TC-009a' 'elapsed AVAILABLE slots report bookable=false' 0 $anyBookable
    $hold = Call POST '/api/v1/bookings/hold-slot' @{ slotId = $elapsed[0].id } $pt
    Check 'TC-009b' 'holding an elapsed slot is refused' 409 $hold.status ($hold.body -replace '\s+', ' ' | Select-Object -First 1)
}
else {
    Write-Host "  (no elapsed AVAILABLE slots today at $nowT - skipping live hold probe)" -ForegroundColor DarkGray
}

$future = (Get-Date).AddDays(3).ToString('yyyy-MM-dd')
$futureSlots = (Call GET "/api/v1/venues/1/slots?date=$future" $null $null).body | ConvertFrom-Json
$freeFuture = @($futureSlots | Where-Object { $_.status -eq 'AVAILABLE' -and $_.bookable })
Check 'TC-009c' 'future slots are still offered' $true ($freeFuture.Count -gt 0)

Write-Host "`n== TC-017 pricing ==" -ForegroundColor Yellow
Check 'TC-017a' 'empty payload -> 400' 400 (Call POST '/api/v1/pricing/quote' @{} $pt).status
$missing = Call POST '/api/v1/pricing/quote' @{ venueId = 1; daysBeforeBooking = 2; occupancyRate = 0.5 } $pt
Check 'TC-017b' 'missing bookingDateTime -> 400' 400 $missing.status
Check 'TC-017c' '400 names the offending field' $true ($missing.body -match 'bookingDateTime')
$neg = Call POST '/api/v1/pricing/quote' @{ venueId = 1; bookingDateTime = '2026-09-01T19:00:00'; daysBeforeBooking = -3; occupancyRate = 0.5 } $pt
Check 'TC-017d' 'negative daysBeforeBooking -> 400' 400 $neg.status
$occ = Call POST '/api/v1/pricing/quote' @{ venueId = 1; bookingDateTime = '2026-09-01T19:00:00'; daysBeforeBooking = 2; occupancyRate = 9 } $pt
Check 'TC-017e' 'occupancyRate out of range -> 400' 400 $occ.status
$badVenueQuote = Call POST '/api/v1/pricing/quote' @{ venueId = 99999999; bookingDateTime = '2026-09-01T19:00:00'; daysBeforeBooking = 2; occupancyRate = 0.5 } $pt
Check 'TC-017f' 'unknown venue -> 404' 404 $badVenueQuote.status
Check 'TC-017g' 'malformed JSON -> 400' 400 (Call POST '/api/v1/pricing/quote' '{"venueId": }' $pt).status
$goodQuote = Call POST '/api/v1/pricing/quote' @{ venueId = 1; sportSlug = 'football'; bookingDateTime = '2026-09-01T19:00:00'; daysBeforeBooking = 2; occupancyRate = 0.5 } $pt
Check 'TC-017h' 'a valid quote still succeeds' 200 $goodQuote.status
if ($goodQuote.status -eq 200) { Write-Host "    quote: $($goodQuote.body)" -ForegroundColor DarkGray }

Write-Host "`n== TC-015 turf requests ==" -ForegroundColor Yellow
Check 'TC-015' 'unknown turf-request code -> 404' 404 (Call GET '/api/v1/admin/turf-requests/BOGUS' $null $at).status

Write-Host "`n== TC-028 booking response shape ==" -ForegroundColor Yellow
$mine = Call GET '/api/v1/bookings' $null $pt
$leaks = @('customer', 'subNum', 'amountFormatted', 'actions', '"dim"') | Where-Object { $mine.body -match $_ }
Check 'TC-028' 'player bookings carry no owner-view fields' 0 $leaks.Count ($leaks -join ',')

Write-Host "`n== entity serialization ==" -ForegroundColor Yellow
$secretPattern = 'passwordHash|twoFactorSecret|failedLoginCount|lockedUntil|"pitches"|"pricingRules"|"owner":'
foreach ($ep in @('/api/v1/admin/users', '/api/v1/admin/venues', '/api/v1/admin/payouts', '/api/v1/admin/turf-requests', '/api/v1/admin/audit-log')) {
    $r = Call GET $ep $null $at
    $bad = ($r.body -match $secretPattern)
    Check 'ENT' "$ep exposes no entity internals" $false $bad "status=$($r.status)"
}
$notif = Call GET '/api/v1/notifications' $null $pt
Check 'ENT' '/api/v1/notifications is a projection (no userId)' $false ($notif.body -match '"userId"') "status=$($notif.status)"

Write-Host "`n== TC-005 review response ==" -ForegroundColor Yellow
Write-Host "  (covered by frontend\qa\review-flow.mjs)" -ForegroundColor DarkGray

$passed = @($results | Where-Object { $_.pass }).Count
$failed = @($results | Where-Object { -not $_.pass }).Count
Write-Host "`n================ SUMMARY ================" -ForegroundColor Cyan
Write-Host ("  passed: {0}   failed: {1}" -f $passed, $failed) -ForegroundColor $(if ($failed -eq 0) { 'Green' } else { 'Red' })
if ($failed -gt 0) { $results | Where-Object { -not $_.pass } | Format-Table -AutoSize | Out-String | Write-Host }

$outDir = Join-Path $PSScriptRoot 'baseline'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$results | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $outDir 'api-audit-post-fix.json') -Encoding UTF8
Write-Host "Written baseline\api-audit-post-fix.json"
