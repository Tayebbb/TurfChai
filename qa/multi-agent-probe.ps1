# Multi-agent probe: architecture contract, security, backend robustness.
# Prints one line per check. Exits non-zero if any FAIL.
$ErrorActionPreference = 'Continue'
$api = 'http://localhost:8080/api/v1'
$script:bad = 0
function Pass($m) { Write-Output "PASS  $m" }
function Fail($m) { Write-Output "FAIL  $m"; $script:bad++ }
function Info($m) { Write-Output "  ..  $m" }

function Login($email, $pass) {
    try {
        return Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType 'application/json' `
            -Body (@{ email = $email; password = $pass } | ConvertTo-Json)
    }
    catch { return $null }
}

# Returns @{ status; body }
function Call($method, $path, $token, $body) {
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    $params = @{ Uri = "$api$path"; Method = $method; Headers = $headers; UseBasicParsing = $true }
    if ($null -ne $body) {
        $params['ContentType'] = 'application/json'
        $params['Body'] = ($body | ConvertTo-Json -Depth 8)
    }
    try {
        $r = Invoke-WebRequest @params
        return @{ status = [int]$r.StatusCode; body = $r.Content }
    }
    catch {
        $resp = $_.Exception.Response
        if ($resp) {
            $code = [int]$resp.StatusCode
            $text = ''
            try { $text = (New-Object System.IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } catch { }
            return @{ status = $code; body = $text }
        }
        return @{ status = 0; body = $_.Exception.Message }
    }
}

$playerA = Login 'rafi@turfchai.dev' 'demo1234'
$playerB = Login 'fahim.rahman.0@gmail.com' 'Demo@12345'
$ownerA = Login 'sumaiya.hossain.65@gmail.com' 'Demo@12345'
$ownerB = Login 'shamim.hossain.66@gmail.com' 'Demo@12345'
if (-not $playerA -or -not $ownerA -or -not $ownerB) { Write-Output 'FAIL  could not sign in the fixtures'; exit 1 }

Write-Output ''
Write-Output '=== AGENT A - ARCHITECTURE CONTRACT ==='

# The owner venue-setup screen sends display strings for policies the DB
# constrains to three constants in a VARCHAR(30) column.
$venues = (Call GET '/owner/venues' $ownerA.token $null)
$vid = ($venues.body | ConvertFrom-Json)[0].id
if (-not $vid) { $vid = (($venues.body | ConvertFrom-Json).data)[0].id }
Info "owner A venue id = $vid"

$before = (Call GET "/owner/venues/$vid" $ownerA.token $null).body | ConvertFrom-Json
Info "cancelPolicy before = '$($before.cancelPolicy)'  depositPolicy = '$($before.depositPolicy)'"

$uiPolicy = 'Free cancel until 24h before ' + [char]0x00B7 + ' 50% within 24h ' + [char]0x00B7 + ' no refund within 6h'
$r = Call PUT "/owner/venues/$vid" $ownerA.token @{ cancelPolicy = $uiPolicy; depositPolicy = '30% deposit allowed' }
if ($r.status -eq 400) {
    Pass "a display-label policy is rejected with 400 rather than silently stored"
}
elseif ($r.status -lt 300) {
    Fail "venue accepted a cancelPolicy the refund engine cannot honour (HTTP $($r.status))"
}
else {
    Fail "unexpected status for an invalid policy: HTTP $($r.status)"
}

# The real vocabulary must round-trip, or the owner cannot set a policy at all.
$r = Call PUT "/owner/venues/$vid" $ownerA.token @{ cancelPolicy = 'STRICT_NO_REFUND'; depositPolicy = 'FIFTY_PERCENT' }
$after = (Call GET "/owner/venues/$vid" $ownerA.token $null).body | ConvertFrom-Json
if ($r.status -lt 300 -and $after.cancelPolicy -eq 'STRICT_NO_REFUND' -and $after.depositPolicy -eq 'FIFTY_PERCENT') {
    Pass "the real policy vocabulary round-trips (cancel=$($after.cancelPolicy) deposit=$($after.depositPolicy))"
}
else {
    Fail "owner cannot store a valid policy (HTTP $($r.status), cancel='$($after.cancelPolicy)')"
}
# Put it back so the money-lifecycle script keeps its expected policy.
Call PUT "/owner/venues/$vid" $ownerA.token @{ cancelPolicy = 'FREE_24H_50_6H'; depositPolicy = 'FULL_ONLY' } | Out-Null

# Owner status vocabulary must match what the UI sends.
$r = Call PUT "/owner/venues/$vid/status" $ownerA.token @{ status = 'PENDING_LISTING' }
if ($r.status -ge 400) {
    Fail "owner UI 'go offline' sends PENDING_LISTING but the API rejects it (HTTP $($r.status))"
}
else {
    Pass "owner status vocabulary accepts PENDING_LISTING"
    Call PUT "/owner/venues/$vid/status" $ownerA.token @{ status = 'LIVE' } | Out-Null
}

Write-Output ''
Write-Output '=== AGENT B - SECURITY ==='

# Cross-owner write.
$vB = (Call GET '/owner/venues' $ownerB.token $null).body | ConvertFrom-Json
$vidB = $vB[0].id; if (-not $vidB) { $vidB = ($vB.data)[0].id }
$r = Call PUT "/owner/venues/$vidB" $ownerA.token @{ name = 'PWNED BY OWNER A' }
if ($r.status -in 401, 403, 404) { Pass "owner A cannot rename owner B's venue (HTTP $($r.status))" }
else { Fail "CROSS-OWNER WRITE: owner A renamed owner B's venue (HTTP $($r.status))" }

# Identity spoofing on booking creation.
$r = Call POST '/bookings/hold-slot' $playerA.token @{ slotId = 1; userId = 999999 }
Info "hold-slot with a forged userId -> HTTP $($r.status)"

# Privilege escalation by self-assigning a role.
$r = Call PATCH '/me' $playerA.token @{ role = 'SUPER_ADMIN' }
$who = (Call GET '/me' $playerA.token $null).body | ConvertFrom-Json
if ($who.role -eq 'PLAYER') { Pass "player cannot promote itself (role still $($who.role))" }
else { Fail "PRIVILEGE ESCALATION: role is now $($who.role)" }

# PII disclosure: an admin-only roster from a player token.
$r = Call GET '/admin/users?page=0&size=1' $playerA.token $null
if ($r.status -in 401, 403) { Pass "player cannot read the user roster (HTTP $($r.status))" }
else { Fail "PII DISCLOSURE: player read /admin/users (HTTP $($r.status))" }

# Review forgery: review a booking that is not yours.
# Player B may have no booking yet, so one is created rather than skipping the
# check - a probe that quietly passes over its own subject proves nothing.
$bkB = (Call GET '/bookings' $playerB.token $null).body | ConvertFrom-Json
$victim = $bkB | Select-Object -First 1
if (-not $victim) {
    # The slots endpoint is keyed by numeric venue id, not slug.
    $vlist = (Call GET '/venues?page=0&size=1' $null $null).body | ConvertFrom-Json
    $venueId = $vlist.items[0].id
    $day = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')
    $free = (Call GET "/venues/$venueId/slots?date=$day" $playerB.token $null).body | ConvertFrom-Json
    $target = @($free | Where-Object { $_.status -eq 'AVAILABLE' -and $_.bookable }) | Select-Object -First 1
    if ($target) {
        Call POST '/bookings/hold-slot' $playerB.token @{ slotId = $target.id } | Out-Null
        Call POST '/payments/checkout' $playerB.token @{ slotId = $target.id; method = 'BKASH'; applyWalletAmount = 0 } | Out-Null
        $bkB = (Call GET '/bookings' $playerB.token $null).body | ConvertFrom-Json
        $victim = $bkB | Select-Object -First 1
    }
}
if ($victim) {
    Info "player B booking under attack = $($victim.id)"
    $r = Call POST '/reviews' $playerA.token @{ bookingId = $victim.id; venueId = $victim.venueId; overallRating = 1; comment = 'forged' }
    if ($r.status -in 400, 401, 403, 404, 409, 422) { Pass "player A cannot review player B's booking (HTTP $($r.status))" }
    else { Fail "REVIEW FORGERY: player A reviewed player B's booking (HTTP $($r.status))" }

    $r = Call POST "/matchday/checkin?bookingId=$($victim.id)" $playerA.token $null
    if ($r.status -in 400, 401, 403, 404) { Pass "player A cannot check in player B's booking (HTTP $($r.status))" }
    else { Fail "CHECK-IN FORGERY: HTTP $($r.status)" }

    $r = Call GET "/bookings/$($victim.id)" $playerA.token $null
    if ($r.status -eq 404) { Pass "player B's booking is indistinguishable from a missing one (404)" }
    else { Fail "CROSS-USER READ or enumeration leak: HTTP $($r.status)" }
}
else {
    Fail 'could not create a player B booking; forgery probes could not run'
}

# Tournament tampering. The actor must be someone who hosts nothing, or a 200
# just means the caller was the host all along - the first version of this
# probe used the demo player, who really does host TR-CUP-0091.
$outsider = $null
foreach ($n in 0..12) {
    $u = Login "fahim.rahman.$n@gmail.com" 'Demo@12345'
    if (-not $u) { continue }
    # Non-hostness proved directly: the host workspace must refuse this caller.
    if ((Call GET "/host/tournaments/TR-CUP-0091" $u.token $null).status -in 401, 403, 404) {
        $outsider = $u
        break
    }
}
if (-not $outsider) {
    Fail 'no non-host player found; tournament tampering probes could not run'
}
else {
    Info "non-host actor = $($outsider.user.email)"
    $code = 'TR-CUP-0091'
    # Payloads are valid so bean validation cannot answer before authorization.
    $r = Call PATCH "/host/tournaments/$code/settings" $outsider.token @{ privacy = 'open'; hostNotes = 'tampered' }
    if ($r.status -in 401, 403, 404) { Pass "non-host cannot edit $code settings (HTTP $($r.status))" }
    else { Fail "TOURNAMENT TAMPERING: settings changed by a non-host (HTTP $($r.status))" }

    $r = Call POST "/host/tournaments/$code/invite-code" $outsider.token $null
    if ($r.status -in 401, 403, 404) { Pass "non-host cannot rotate $code invite code (HTTP $($r.status))" }
    else { Fail "TOURNAMENT TAMPERING: invite rotation by a non-host (HTTP $($r.status))" }

    $r = Call POST "/host/tournaments/$code/balance" $outsider.token @{ method = 'bKash'; payerReference = 'x' }
    if ($r.status -in 401, 403, 404) { Pass "non-host cannot settle $code balance (HTTP $($r.status))" }
    else { Fail "TOURNAMENT TAMPERING: balance settled by a non-host (HTTP $($r.status))" }

    $r = Call POST "/host/tournaments/$code/fixtures/generate" $outsider.token $null
    if ($r.status -in 401, 403, 404) { Pass "non-host cannot regenerate $code fixtures (HTTP $($r.status))" }
    else { Fail "TOURNAMENT TAMPERING: fixtures regenerated by a non-host (HTTP $($r.status))" }

    $r = Call GET "/host/tournaments/$code" $outsider.token $null
    if ($r.status -in 401, 403, 404) { Pass "non-host cannot read the $code host workspace (HTTP $($r.status))" }
    else { Fail "CROSS-HOST READ: HTTP $($r.status)" }
}

Write-Output ''
Write-Output '=== AGENT C - BACKEND ROBUSTNESS ==='

# Missing entity must be 404, never 500.
foreach ($p in @('/bookings/99999999', '/venues/no-such-venue-slug', '/payments/booking/99999999', '/tournaments/NOPE-0000')) {
    $r = Call GET $p $playerA.token $null
    if ($r.status -eq 500) { Fail "$p returned 500 for a missing entity" }
    elseif ($r.status -in 400, 404) { Pass "$p -> $($r.status)" }
    else { Info "$p -> $($r.status)" }
}

# Wrong id type must be 400, never 500.
$r = Call GET '/bookings/not-a-number' $playerA.token $null
if ($r.status -eq 500) { Fail '/bookings/not-a-number returned 500' } else { Pass "/bookings/not-a-number -> $($r.status)" }

# Malformed payloads.
$r = Call POST '/bookings/hold-slot' $playerA.token @{ slotId = 'abc' }
if ($r.status -eq 500) { Fail 'hold-slot with a non-numeric slotId returned 500' } else { Pass "hold-slot non-numeric slotId -> $($r.status)" }

$r = Call POST '/bookings/hold-slot' $playerA.token @{ }
if ($r.status -eq 500) { Fail 'hold-slot with an empty body returned 500' } else { Pass "hold-slot empty body -> $($r.status)" }

$r = Call POST '/reviews' $playerA.token @{ overallRating = 99 }
if ($r.status -eq 500) { Fail 'review with rating 99 returned 500' } else { Pass "review rating 99 -> $($r.status)" }

# Oversized input must not 500.
$big = 'x' * 20000
$r = Call POST '/reviews' $playerA.token @{ bookingId = 1; venueId = 1; overallRating = 5; comment = $big }
if ($r.status -eq 500) { Fail 'a 20k-character review comment returned 500' } else { Pass "20k-char comment -> $($r.status)" }

# Negative / absurd paging must not 500.
foreach ($q in @('?page=-5&size=-1', '?page=999999&size=10', '?size=999999')) {
    $r = Call GET "/venues$q" $null $null
    if ($r.status -eq 500) { Fail "/venues$q returned 500" } else { Pass "/venues$q -> $($r.status)" }
}

Write-Output ''
if ($script:bad -gt 0) { Write-Output "$($script:bad) FINDING(S)"; exit 1 }
Write-Output 'ALL PROBES CLEAN'
exit 0
