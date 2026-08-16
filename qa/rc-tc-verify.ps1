# Release-candidate verification of every finding in the original QA report.
#
# Each check re-runs the ORIGINAL reproduction against the running server and
# demands the new, safe behaviour. Nothing here trusts the source code: a check
# passes only when the server answers correctly.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\qa\rc-tc-verify.ps1
#
# Exit code 0 only when every TC passes.

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$API = 'http://localhost:8080/api/v1'
$ROOT = 'http://localhost:8080'
$DEMO_PW = 'Demo@12345'

$script:results = @()
$script:failed = 0

function Verdict($id, $ok, $what, $evidence) {
    $script:results += [ordered]@{ id = $id; verdict = $(if ($ok) { 'PASS' } else { 'FAIL' }); what = $what; evidence = $evidence }
    if ($ok) {
        Write-Host ("PASS  {0,-10} {1}" -f $id, $what) -ForegroundColor Green
    }
    else {
        Write-Host ("FAIL  {0,-10} {1}" -f $id, $what) -ForegroundColor Red
        Write-Host ("      evidence: {0}" -f $evidence) -ForegroundColor Red
        $script:failed++
    }
}

function Call($method, $path, $token, $body, $extraHeaders) {
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    if ($extraHeaders) { foreach ($k in $extraHeaders.Keys) { $headers[$k] = $extraHeaders[$k] } }
    $uri = if ($path -like 'http*') { $path } else { "$API$path" }
    # Not $args: that is an automatic variable and splatting it is unreliable.
    $req = @{ Uri = $uri; Method = $method; Headers = $headers; UseBasicParsing = $true; TimeoutSec = 40 }
    if ($null -ne $body) {
        $req['ContentType'] = 'application/json'
        $req['Body'] = ($body | ConvertTo-Json -Depth 8)
    }
    try {
        $r = Invoke-WebRequest @req
        return @{ status = [int]$r.StatusCode; body = $r.Content }
    }
    catch {
        $resp = $_.Exception.Response
        if ($resp) {
            $text = ''
            try {
                $stream = $resp.GetResponseStream()
                # Without this the reader starts at EOF and every error body
                # looks empty, which silently turns real assertions into passes.
                if ($stream.CanSeek) { $stream.Position = 0 }
                $text = (New-Object System.IO.StreamReader($stream)).ReadToEnd()
            }
            catch { $text = '' }
            return @{ status = [int]$resp.StatusCode; body = $text }
        }
        return @{ status = 0; body = "$($_.Exception.Message)" }
    }
}

function Login($email, $password) {
    $r = Call POST '/auth/login' $null @{ email = $email; password = $password }
    if ($r.status -ne 200) { return $null }
    $d = $r.body | ConvertFrom-Json
    return @{ token = $d.token; user = $d.user }
}

# An empty or non-JSON body must count as zero rows, not one phantom object.
# `@('[]' | ConvertFrom-Json)` yields a single $null in PowerShell 5.1.
function Rows($text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return @() }
    try { $p = $text | ConvertFrom-Json } catch { return @() }
    if ($null -eq $p) { return @() }
    return @($p | Where-Object { $null -ne $_ })
}

# Admin and payment responses are wrapped in ApiResponse {data,error,message,success}.
function Unwrap($text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    try { $p = $text | ConvertFrom-Json } catch { return $null }
    if ($null -ne $p -and ($p.PSObject.Properties.Name -contains 'data') -and ($p.PSObject.Properties.Name -contains 'success')) {
        return $p.data
    }
    return $p
}

function AdminLogin($email) {
    # The gate signs in once and shares the token; each stage logging in again
    # exhausts the 5-per-15-minute 2FA throttle mid-run.
    if ($env:QA_ADMIN_TOKEN) { return @{ token = $env:QA_ADMIN_TOKEN } }
    $ch = Call POST '/admin/auth/login' $null @{ email = $email; password = $DEMO_PW }
    if ($ch.status -ne 200) { return $null }
    # The challenge response is NOT wrapped in ApiResponse.
    $d = $ch.body | ConvertFrom-Json
    $challenge = if ($d.challenge) { $d.challenge } else { $d.data.challenge }
    $codeValue = if ($d.devCode) { $d.devCode } else { $d.data.devCode }
    if (-not $codeValue) { return $null }
    $v = Call POST '/admin/auth/login/verify' $null @{ challenge = $challenge; code = $codeValue }
    if ($v.status -ne 200) { return $null }
    $vj = $v.body | ConvertFrom-Json
    if ($vj.token) { return $vj }
    return $vj.data
}

Write-Host ''
Write-Host '=== RELEASE-CANDIDATE TC VERIFICATION (live server) ===' -ForegroundColor Cyan
Write-Host ''

# --- actors -----------------------------------------------------------------
$playerA = Login 'rafi@turfchai.dev' 'demo1234'
if (-not $playerA) { Write-Host 'FATAL: cannot sign in as the demo player' -ForegroundColor Red; exit 2 }

$playerB = $null; $ownerA = $null; $ownerB = $null
$admin = $null
foreach ($n in 0..3) { $admin = AdminLogin "admin$n@turfchai.com"; if ($admin) { break } }

# Actors are discovered from the real roster. Guessing demo addresses found only
# one account and silently skipped half the matrix.
$roster = @()
if ($admin) {
    foreach ($role in @('OWNER', 'PLAYER')) {
        $rr = Call GET "/admin/users?page=0&size=60&role=$role" $admin.token $null
        if ($rr.status -eq 200) { $roster += @((Unwrap $rr.body).items) }
    }
}
foreach ($u in $roster) {
    if (-not $u.email) { continue }
    if ($playerB -and $ownerA -and $ownerB) { break }
    $c = Login $u.email $DEMO_PW
    if (-not $c) { continue }
    if ($c.user.role -eq 'PLAYER' -and -not $playerB -and $c.user.id -ne $playerA.user.id) { $playerB = $c; continue }
    if ($c.user.role -eq 'OWNER') {
        # An owner with no venue cannot be the subject of a tenant-isolation
        # probe, and picking one silently turns the check into a skip.
        $owned = Rows (Call GET '/owner/venues' $c.token $null).body
        if ($owned.Count -eq 0) { continue }
        if (-not $ownerA) { $ownerA = $c } elseif (-not $ownerB) { $ownerB = $c }
    }
}
if (-not $playerB) { $playerB = Login 'fahim.rahman.0@gmail.com' $DEMO_PW }

# Resolved once so every admin-venue check works from the same list.
$adminVenues = @()
$adminVenuesNote = 'no admin session'
if ($admin) {
    $avRaw = Call GET '/admin/venues?page=0&size=25' $admin.token $null
    $avData = Unwrap $avRaw.body
    # An array must be tested first: PowerShell member enumeration makes
    # `$array.items` return one $null per element, which is a truthy array and
    # silently swallows the whole list.
    $cand = if ($avData -is [System.Array]) { $avData }
    elseif ($avData.items) { $avData.items }
    elseif ($avData.content) { $avData.content }
    else { $avData }
    $adminVenues = @($cand | Where-Object { $_ -and $_.id })
    $adminVenuesNote = "HTTP $($avRaw.status) len=$($avRaw.body.Length) resolved=$($adminVenues.Count)"
}

# The forgery probes need a booking that genuinely belongs to player B. The demo
# roster does not guarantee one, and a probe that skips its own subject proves
# nothing - so create it.
function EnsureBookingFor($actor) {
    $existing = Rows (Call GET '/bookings' $actor.token $null).body
    if ($existing.Count -gt 0) { return $existing[0] }
    $vl = Unwrap (Call GET '/venues?page=0&size=10' $null $null).body
    foreach ($v in @($vl.items)) {
        foreach ($d in 1..3) {
            $day = (Get-Date).AddDays($d).ToString('yyyy-MM-dd')
            $slots = Rows (Call GET "/venues/$($v.id)/slots?date=$day" $actor.token $null).body
            $free = @($slots | Where-Object { $_.status -eq 'AVAILABLE' -and $_.bookable }) | Select-Object -First 1
            if (-not $free) { continue }
            $hold = Call POST '/bookings/hold-slot' $actor.token @{ slotId = $free.id }
            if ($hold.status -ge 400) { continue }
            Call POST '/payments/checkout' $actor.token @{ slotId = $free.id; method = 'BKASH'; applyWalletAmount = 0 } | Out-Null
            $after = Rows (Call GET '/bookings' $actor.token $null).body
            if ($after.Count -gt 0) { return $after[0] }
        }
    }
    return $null
}

Write-Host ("  actors: playerA={0} playerB={1} ownerA={2} ownerB={3} admin={4}" -f `
        $playerA.user.email, $playerB.user.email, $ownerA.user.email, $ownerB.user.email, $(if ($admin) { 'yes' } else { 'RATE-LIMITED' })) -ForegroundColor DarkGray
Write-Host ''

# --- TC-001: X-User-Id impersonation ----------------------------------------
# The original report drove all six probes with no token and a forged header.
$victimPublicId = $playerB.user.publicId
$hdr = @{ 'X-User-Id' = "$victimPublicId" }
$probes = @(
    @{ m = 'GET'; p = '/players/me' },
    @{ m = 'GET'; p = '/players/me/saved-venues' },
    @{ m = 'POST'; p = '/players/me/saved-venues/mirpur-sports-city' },
    @{ m = 'DELETE'; p = '/players/me/saved-venues/mirpur-sports-city' }
)
$bad = @()
foreach ($pr in $probes) {
    $r = Call $pr.m $pr.p $null $null $hdr
    if ($r.status -notin 401, 403) { $bad += "$($pr.m) $($pr.p) -> $($r.status)" }
}
$r = Call PATCH '/players/me' $null @{ fullName = 'TC001 TAMPERED'; bio = 'x' } $hdr
if ($r.status -notin 401, 403) { $bad += "PATCH /players/me -> $($r.status)" }
$r = Call GET '/players/me' $null $null $null
if ($r.status -notin 401, 403) { $bad += "GET /players/me with no header -> $($r.status)" }
# and the victim must be untouched
$after = Call GET '/players/me' $playerB.token $null
$tampered = ($after.body -match 'TC001 TAMPERED')
Verdict 'TC-001' (($bad.Count -eq 0) -and (-not $tampered)) `
    'X-User-Id impersonation refused on all 6 original probes; victim profile intact' `
$(if ($bad.Count) { $bad -join '; ' } else { 'all 401/403, profile unchanged' })

# --- TC-002: anonymous tournament manipulation ------------------------------
$code = 'TR-CUP-0091'
$anonProbes = @(
    @{ m = 'GET'; p = "/host/tournaments/$code"; b = $null },
    @{ m = 'POST'; p = "/tournaments/$code/register"; b = @{ teamName = 'TC002 Ghost FC' } },
    @{ m = 'DELETE'; p = "/tournaments/$code/register"; b = $null },
    @{ m = 'POST'; p = "/host/tournaments/$code/teams/1/entry-fee"; b = @{ amount = 3500 } },
    @{ m = 'POST'; p = "/host/tournaments/$code/fixtures/generate"; b = $null },
    @{ m = 'POST'; p = '/host/tournaments'; b = @{ name = 'TC002'; venueSlug = 'mirpur-sports-city' } }
)
$bad = @()
foreach ($pr in $anonProbes) {
    $r = Call $pr.m $pr.p $null $pr.b $hdr
    if ($r.status -notin 401, 403) { $bad += "$($pr.m) $($pr.p) -> $($r.status)" }
}
Verdict 'TC-002' ($bad.Count -eq 0) 'every anonymous tournament operation refused' `
$(if ($bad.Count) { $bad -join '; ' } else { 'all 6 probes 401/403' })

# --- TC-003: player bookings list renders with REAL bookings ----------------
# The crash came from a link built on a path key that does not exist; the data
# contract behind it must still return populated rows, not just an empty list.
$bk = Call GET '/bookings' $playerA.token $null
$rows = Rows $bk.body
$hasReal = $rows.Count -gt 0 -and ($rows | Where-Object { $_.bookingCode -and $_.venueName }).Count -gt 0
Verdict 'TC-003' (($bk.status -eq 200) -and $hasReal) `
    'the bookings list returns populated rows (not an empty-state-only pass)' `
    "status=$($bk.status) rows=$($rows.Count) firstCode=$($rows[0].bookingCode)"

# --- TC-004: admin turf detail across MANY ids ------------------------------
if ($admin) {
    $bad = @()
    foreach ($v in ($adminVenues | Select-Object -First 12)) {
        $d = Call GET "/admin/venues/$($v.id)" $admin.token $null
        $a = Call GET "/admin/venues/$($v.id)/analytics" $admin.token $null
        if ($d.status -ne 200) { $bad += "detail $($v.id)->$($d.status)" }
        if ($a.status -ne 200) { $bad += "analytics $($v.id)->$($a.status)" }
    }
    Verdict 'TC-004' (($bad.Count -eq 0) -and ($adminVenues.Count -gt 0)) 'admin turf detail + analytics answer 200 for every id tried' `
    $(if ($bad.Count) { $bad -join '; ' } elseif ($adminVenues.Count -eq 0) { "no venue resolved: $adminVenuesNote" } else { "$($adminVenues.Count) venue ids checked, all 200" })
}
else {
    Verdict 'TC-004' $false 'admin turf detail' 'admin 2FA rate-limited; restart the backend and re-run'
}

# --- TC-005 / TC-007: review path -------------------------------------------
$bkB = EnsureBookingFor $playerB
if ($bkB) {
    $r = Call POST '/reviews' $playerA.token @{ bookingId = $bkB.id; userId = $playerA.user.id; venueId = $bkB.venueId; overallRating = 1; subRatings = @{}; comment = 'TC-007 forged authorship'; parentReview = $false }
    Verdict 'TC-007' ($r.status -in 401, 403, 404) "reviewing another player's booking is refused" "HTTP $($r.status)"
    Verdict 'TC-005' ($r.status -lt 500) 'the review path answers 4xx, never 5xx' "HTTP $($r.status)"
}
else {
    Verdict 'TC-007' $false "reviewing another player's booking is refused" 'no booking for player B to attack'
    Verdict 'TC-005' $false 'review path answers 4xx' 'no booking fixture'
}

# --- TC-006: check-in ownership ---------------------------------------------
if ($bkB) {
    $r = Call POST "/matchday/checkin?bookingId=$($bkB.id)" $playerA.token $null
    Verdict 'TC-006' ($r.status -in 401, 403, 404) "checking in another player's booking is refused" "HTTP $($r.status)"
}
else {
    Verdict 'TC-006' $false 'check-in ownership' 'no booking fixture'
}

# --- TC-008: signed-out identity leakage ------------------------------------
$leaks = @()
foreach ($p in @('/players/me', '/me', '/bookings', '/rewards/my-points', '/notifications')) {
    $r = Call GET $p $null $null
    if ($r.status -notin 401, 403) { $leaks += "$p -> $($r.status)" }
}
Verdict 'TC-008' ($leaks.Count -eq 0) 'no identity endpoint answers an anonymous caller' `
$(if ($leaks.Count) { $leaks -join '; ' } else { '5 identity endpoints all 401/403' })

# --- TC-009 / QA-N07: elapsed slots -----------------------------------------
$vs = (Call GET '/venues?page=0&size=1' $null $null).body | ConvertFrom-Json
$venueId = $vs.items[0].id
$today = (Get-Date).ToString('yyyy-MM-dd')
$slotsToday = Rows (Call GET "/venues/$venueId/slots?date=$today" $null $null).body
$elapsed = @($slotsToday | Where-Object {
        $_.startTime -and [datetime]::TryParse("$today $($_.startTime)", [ref]([datetime]::MinValue)) -and
        ([datetime]::Parse("$today $($_.startTime)") -lt (Get-Date))
    })
$wrong = @($elapsed | Where-Object { $_.bookable })
Verdict 'TC-009' ($wrong.Count -eq 0) 'no elapsed slot is advertised as bookable' `
    "$($elapsed.Count) elapsed slot(s), $($wrong.Count) wrongly bookable"
if ($elapsed.Count -gt 0) {
    $r = Call POST '/bookings/hold-slot' $playerA.token @{ slotId = $elapsed[0].id }
    Verdict 'TC-009b' ($r.status -ge 400) 'holding an elapsed slot is refused' "HTTP $($r.status)"
}
else {
    Verdict 'TC-009b' $true 'holding an elapsed slot is refused' 'no elapsed slot today to attempt (checked)'
}
$past = Rows (Call GET "/venues/$venueId/slots?date=1999-01-01" $null $null).body
$far = Rows (Call GET "/venues/$venueId/slots?date=$((Get-Date).AddDays(300).ToString('yyyy-MM-dd'))" $null $null).body
Verdict 'QA-N07' (($past.Count -eq 0) -and ($far.Count -eq 0)) 'slot rows are not generated for past or far-future dates' `
    "1999 -> $($past.Count) rows, +300d -> $($far.Count) rows"

# --- TC-010: no fabricated settlement ---------------------------------------
$r = Call GET '/payments/booking/99999999' $playerA.token $null
Verdict 'TC-010' ($r.status -eq 404) 'a missing payment record is 404, never a fabricated settlement' "HTTP $($r.status)"

# --- TC-012: owner occupancy is derived -------------------------------------
if ($ownerA) {
    $d = Call GET '/owner/analytics/dashboard' $ownerA.token $null
    $dj = Unwrap $d.body
    $occ = (@($dj.kpis) | Where-Object { $_.label -eq 'Occupancy' } | Select-Object -First 1).value
    Verdict 'TC-012' (($d.status -eq 200) -and ($occ -ne '100%')) 'owner occupancy is derived, not the hardcoded 100%' `
        "HTTP $($d.status) occupancy=$occ"
}
else { Verdict 'TC-012' $false 'owner occupancy' 'no OWNER actor with a venue found' }

# --- TC-013: admin turf analytics are real ----------------------------------
if ($adminVenues.Count -gt 0) {
    $vid = $adminVenues[0].id
    $an = Call GET "/admin/venues/$vid/analytics" $admin.token $null
    $a = Unwrap $an.body
    $fabricated = ($a.revenue30d -eq 150000) -or ($a.bookings30d -eq 142) -or ($a.occupancyPercent -eq 72)
    Verdict 'TC-013' (($an.status -eq 200) -and ($null -ne $a) -and (-not $fabricated)) 'admin turf analytics come from real rows' `
        "HTTP $($an.status) venueId=$vid bookings30d=$($a.bookings30d) revenue30d=$($a.revenue30d) occupancy=$($a.occupancyPercent)"
}
else { Verdict 'TC-013' $false 'admin turf analytics' "no venue resolved: $adminVenuesNote" }

# --- TC-014: admin roster is paginated server-side --------------------------
if ($admin) {
    $r = Call GET '/admin/users?page=0&size=10' $admin.token $null
    $j = Unwrap $r.body
    $kb = [math]::Round(($r.body.Length / 1KB), 1)
    Verdict 'TC-014' (($r.status -eq 200) -and (@($j.items).Count -le 10) -and ($kb -lt 50)) `
        'the admin roster is paginated server-side' "rows=$(@($j.items).Count) size=${kb}KB total=$($j.total)"
    $r2 = Call GET '/admin/users?page=0&size=100000' $admin.token $null
    $j2 = Unwrap $r2.body
    Verdict 'TC-014b' (($r2.status -ge 400) -or (@($j2.items).Count -le 100)) 'page size is capped' `
        "HTTP $($r2.status) rows=$(@($j2.items).Count)"
}
else {
    Verdict 'TC-014' $false 'admin roster pagination' 'admin rate-limited'
    Verdict 'TC-014b' $false 'page size cap' 'admin rate-limited'
}

# --- TC-015: unknown turf-request code --------------------------------------
if ($admin) {
    $r = Call GET '/admin/turf-requests/REQ-NOPE-0000' $admin.token $null
    Verdict 'TC-015' ($r.status -eq 404) 'an unknown turf-request code is 404' "HTTP $($r.status)"
}
else { Verdict 'TC-015' $false 'unknown turf-request code' 'admin rate-limited' }

# --- TC-017: pricing payloads never 500 -------------------------------------
$payloads = @(
    @{}, @{ venueId = 'abc' }, @{ venueId = -1; bookingDateTime = 'nope' },
    @{ venueId = $venueId; bookingDateTime = '2026-01-01T10:00'; occupancyRate = 99 },
    @{ venueId = 99999999; bookingDateTime = '2026-01-01T10:00' },
    @{ venueId = $venueId; daysBeforeBooking = -5 }
)
$bad = @()
foreach ($p in $payloads) {
    $r = Call POST '/pricing/quote' $ownerA.token $p
    if ($r.status -ge 500) { $bad += "$($p | ConvertTo-Json -Compress) -> $($r.status)" }
}
Verdict 'TC-017' ($bad.Count -eq 0) 'every bad pricing payload is a deliberate 4xx, never a 500' `
$(if ($bad.Count) { $bad -join '; ' } else { "$($payloads.Count) payloads, no 5xx" })

# --- TC-018: identity payload carries fullName ------------------------------
$me = Call GET '/me' $ownerA.token $null
$mj = $me.body | ConvertFrom-Json
Verdict 'TC-018' ([bool]$mj.fullName) 'the identity payload carries fullName, the field the greeting reads' `
    "fullName=$($mj.fullName)"

# --- TC-021: ML pricing answers a real quote --------------------------------
$q = Call POST '/pricing/quote' $ownerA.token @{ venueId = $venueId; bookingDateTime = "$((Get-Date).AddDays(2).ToString('yyyy-MM-dd'))T19:00"; daysBeforeBooking = 2; occupancyRate = 0.5 }
$qj = $q.body | ConvertFrom-Json
$price = $qj.suggestedPrice
if (-not $price) { $price = $qj.data.suggestedPrice }
Verdict 'TC-021' (($q.status -eq 200) -and ($price -gt 0)) 'the ML pricing engine answers a real quote' `
    "HTTP $($q.status) suggestedPrice=$price"

# --- TC-024: error envelope -------------------------------------------------
$anon = Call GET '/bookings' $null $null
$env1 = ($anon.body -match '"status"') -and ($anon.body -match '"message"') -and ($anon.body -match '"timestamp"')
$unrouted = Call GET '/definitely-not-a-route' $playerA.token $null
$forbidden = Call GET '/admin/users' $playerA.token $null
$env2 = ($forbidden.body -match '"message"')
Verdict 'TC-024' (($anon.status -eq 401) -and $env1 -and ($unrouted.status -eq 404) -and ($forbidden.status -eq 403) -and $env2) `
    'the error envelope is consistent and populated for 401/403/404' `
    "401=$($anon.status) envelope=$env1; 404=$($unrouted.status); 403=$($forbidden.status) body=$env2"

# --- TC-025: slots for an unknown venue -------------------------------------
$r = Call GET "/venues/99999999/slots?date=$today" $null $null
Verdict 'TC-025' ($r.status -ge 400) 'slots for an unknown venue are not an empty 200' "HTTP $($r.status)"

# --- TC-026: OWNER signup creates no placeholder venue ----------------------
$suffix = [guid]::NewGuid().ToString('N').Substring(0, 8)
$newEmail = "rc.owner.$suffix@turfchai.test"
$newPhone = '+88017' + (Get-Random -Minimum 10000000 -Maximum 99999999)
$reg = Call POST '/auth/register' $null @{ fullName = 'RC Owner'; email = $newEmail; password = 'Demo@12345'; phone = $newPhone; role = 'OWNER' }
$newOwner = Login $newEmail 'Demo@12345'
if ($newOwner) {
    $vlist = Rows (Call GET '/owner/venues' $newOwner.token $null).body
    Verdict 'TC-026' ($vlist.Count -eq 0) 'registering as OWNER creates no placeholder venue' "$($vlist.Count) venue(s) after signup"
}
else {
    Verdict 'TC-026' $false 'OWNER signup placeholder venue' "registration HTTP $($reg.status)"
}

# --- TC-028: player booking list carries no owner-view fields ---------------
$ownerFields = @('customerPhone', 'customerName', 'ownerNotes', 'payoutAmount', 'platformFee', 'netToOwner')
$leaked = @()
if ($rows.Count -gt 0) {
    $names = $rows[0].PSObject.Properties.Name
    foreach ($f in $ownerFields) { if ($names -contains $f) { $leaked += $f } }
}
Verdict 'TC-028' ($leaked.Count -eq 0) "a player's booking list carries no owner-view fields" `
$(if ($leaked.Count) { "leaked: $($leaked -join ',')" } else { 'none of 6 owner fields present' })

# --- TC-029: API docs require authentication --------------------------------
$d1 = Call GET "$ROOT/v3/api-docs" $null $null
$d2 = Call GET "$ROOT/swagger-ui/index.html" $null $null
Verdict 'TC-029' (($d1.status -in 401, 403) -and ($d2.status -in 401, 403)) 'API docs and Swagger UI require authentication' `
    "api-docs=$($d1.status) swagger-ui=$($d2.status)"

# --- TC-032: trusted-integration booking endpoint ---------------------------
$r = Call POST '/bookings' $playerA.token @{ slotId = 1 }
Verdict 'TC-032' ($r.status -in 401, 403) 'the trusted-integration booking endpoint refuses players' "HTTP $($r.status)"

# --- Cross-tenant isolation (QA-N09/N10) ------------------------------------
if ($ownerA -and $ownerB) {
    $vaResp = Call GET '/owner/venues' $ownerA.token $null
    $parsed = $null
    try { $parsed = $vaResp.body | ConvertFrom-Json } catch { $parsed = $null }
    $vaList = @($parsed | Where-Object { $_ -and $_.id })
    if ($vaList.Count -gt 0) {
        $target = $vaList[0]
        $r = Call PUT "/owner/venues/$($target.id)" $ownerB.token @{ name = 'CROSS OWNER TAMPER' }
        Verdict 'QA-N09' ($r.status -in 401, 403, 404) "owner B cannot modify owner A's venue" `
            "HTTP $($r.status) targetVenue=$($target.id)"
    }
    else {
        Verdict 'QA-N09' $false 'cross-owner isolation' "owner A venue list HTTP $($vaResp.status) len=$($vaResp.body.Length) head=$($vaResp.body.Substring(0,[Math]::Min(60,$vaResp.body.Length)))"
    }
}
else { Verdict 'QA-N09' $false 'cross-owner isolation' 'two OWNER actors not found' }

# --- summary ----------------------------------------------------------------
$outDir = Join-Path $PSScriptRoot 'baseline'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$script:results | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $outDir 'rc-tc-matrix.json') -Encoding UTF8

Write-Host ''
if ($script:failed -eq 0) {
    Write-Host "ALL TC CHECKS PASSED ($($script:results.Count) checks)" -ForegroundColor Green
    exit 0
}
Write-Host "$($script:failed) TC CHECK(S) FAILED out of $($script:results.Count)" -ForegroundColor Red
exit 1
