<#
    TurfChai — deterministic QA dataset seeder (QA tooling, not application source).

    Drives only the project's public REST API against the supported `dev` profile
    (in-memory H2 + existing seeders), so it never touches production config and
    never writes to a developer's real database. The dev database is in-memory:
    restarting the backend gives a clean slate, which is what makes this
    reproducible.

    Usage:
        powershell -NoProfile -ExecutionPolicy Bypass -File qa\seed-qa-dataset.ps1

    Emits qa\baseline\qa-dataset.json describing every account and entity created,
    including the server-generated ids discovered at run time.
#>
param(
    [string]$BaseUrl = 'http://localhost:8080',
    [string]$OutFile = "$PSScriptRoot\baseline\qa-dataset.json"
)

$ErrorActionPreference = 'Stop'
$script:Steps = @()

# ── Fixed QA identities (deterministic; the dev DB is in-memory) ─────────────
$QA_PASSWORD = 'QaPass@12345'
$ACCOUNTS = @(
    @{ key = 'playerA';    email = 'qa.player.a@turfchai.test';    name = 'QA PlayerA Alpha';  phone = '+8801900000001'; role = 'PLAYER' }
    @{ key = 'playerB';    email = 'qa.player.b@turfchai.test';    name = 'QA PlayerB Bravo';  phone = '+8801900000002'; role = 'PLAYER' }
    @{ key = 'playerZero'; email = 'qa.player.zero@turfchai.test'; name = 'QA PlayerZero Nil'; phone = '+8801900000003'; role = 'PLAYER' }
    @{ key = 'ownerA';     email = 'qa.owner.a@turfchai.test';     email2 = $null; name = 'QA OwnerA Ltd'; phone = '+8801900000004'; role = 'OWNER' }
    @{ key = 'ownerB';     email = 'qa.owner.b@turfchai.test';     name = 'QA OwnerB Ltd';     phone = '+8801900000005'; role = 'OWNER' }
    @{ key = 'soloPlayer'; email = 'qa.solo.a@turfchai.test';      name = 'QA Solo Sierra';    phone = '+8801900000006'; role = 'SOLO_PLAYER' }
)
# Pre-existing seeded identities (see PlayerDataSeeder / AdminDataSeeder / AdminDemoDataSeeder)
$SEEDED = @{
    demoPlayer = @{ email = 'rafi@turfchai.dev';                 password = 'demo1234';    role = 'PLAYER (owns the 10 demo venues)' }
    superAdmin = @{ email = 'fazle.rabbi.mugdho@gmail.com';      password = 'Demo@12345';  role = 'SUPER_ADMIN (2FA login)' }
    admin      = @{ email = 'admin0@turfchai.com';               password = 'Demo@12345';  role = 'ADMIN' }
}

function Step($name, $detail) {
    $script:Steps += [pscustomobject]@{ step = $name; detail = "$detail" }
    Write-Host ("  [{0}] {1}" -f $name, $detail)
}

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body, [hashtable]$Headers = @{}, [switch]$Raw)
    $h = @{}
    $Headers.GetEnumerator() | ForEach-Object { $h[$_.Key] = $_.Value }
    $args = @{ Uri = "$BaseUrl$Path"; Method = $Method; Headers = $h; UseBasicParsing = $true; TimeoutSec = 40 }
    if ($null -ne $Body) { $args.Body = ($Body | ConvertTo-Json -Depth 8); $args.ContentType = 'application/json' }
    try {
        $r = Invoke-WebRequest @args
        $content = $r.Content
        $parsed = $null
        if ($content) { try { $parsed = $content | ConvertFrom-Json } catch { $parsed = $content } }
        return [pscustomobject]@{ ok = $true; status = [int]$r.StatusCode; data = $parsed; raw = $content }
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode.value__ }
        $msg = $_.ErrorDetails.Message
        if (-not $msg) { $msg = $_.Exception.Message }
        return [pscustomobject]@{ ok = $false; status = $code; data = $null; raw = $msg }
    }
}

function Auth($token) { return @{ Authorization = "Bearer $token" } }

function Login($email, $password) {
    $r = Invoke-Api POST '/api/v1/auth/login' @{ email = $email; password = $password }
    if (-not $r.ok) { return $null }
    return $r.data
}

function EnsureAccount($acct) {
    $r = Invoke-Api POST '/api/v1/auth/register' @{
        fullName = $acct.name; email = $acct.email; password = $QA_PASSWORD
        phone = $acct.phone; role = $acct.role
    }
    if ($r.ok) { Step 'register' "$($acct.key) -> id=$($r.data.user.id) $($acct.email)"; return $r.data }
    if ($r.status -eq 409) {
        $s = Login $acct.email $QA_PASSWORD
        Step 'register' "$($acct.key) already existed -> id=$($s.user.id)"
        return $s
    }
    Step 'register-FAILED' "$($acct.key) status=$($r.status) $($r.raw)"
    return $null
}

Write-Host "`n=== TurfChai deterministic QA seeding ===" -ForegroundColor Cyan
$health = Invoke-Api GET '/api/v1/health'
if (-not $health.ok) { throw "Backend not reachable at $BaseUrl" }
Step 'health' ($health.data | ConvertTo-Json -Compress)

# ── 1. Sessions ─────────────────────────────────────────────────────────────
Write-Host "`n-- accounts --" -ForegroundColor Yellow
$S = @{}
foreach ($a in $ACCOUNTS) { $S[$a.key] = EnsureAccount $a }
$S['demoPlayer'] = Login $SEEDED.demoPlayer.email $SEEDED.demoPlayer.password
Step 'login' "demoPlayer id=$($S.demoPlayer.user.id) publicId=$($S.demoPlayer.user.publicId)"
$S['admin'] = Login $SEEDED.admin.email $SEEDED.admin.password
if ($S.admin) { Step 'login' "admin id=$($S.admin.user.id) role=$($S.admin.user.role)" }

$ch = Invoke-Api POST '/api/v1/admin/auth/login' @{ email = $SEEDED.superAdmin.email; password = $SEEDED.superAdmin.password }
$superAdmin = $null
if ($ch.ok) {
    $vf = Invoke-Api POST '/api/v1/admin/auth/login/verify' @{ challenge = $ch.data.challenge; code = $ch.data.devCode }
    if ($vf.ok) { $superAdmin = $vf.data; Step 'login' "superAdmin id=$($superAdmin.user.id) role=$($superAdmin.user.role)" }
}
$S['superAdmin'] = $superAdmin

# ── 2. Venue / slot discovery ───────────────────────────────────────────────
Write-Host "`n-- venues & slots --" -ForegroundColor Yellow
$venuesRes = Invoke-Api GET '/api/v1/venues?size=50'
$venues = $venuesRes.data.items
Step 'venues' "$($venues.Count) live venues discovered"

$today = (Get-Date).ToString('yyyy-MM-dd')
$tomorrow = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')
$nowTime = (Get-Date).ToString('HH:mm:ss')

function SlotsFor($venueId, $date) {
    $r = Invoke-Api GET "/api/v1/venues/$venueId/slots?date=$date"
    if ($r.ok) { return $r.data } else { return @() }
}
function PickSlot($venueId, $date, [switch]$PastOnly, [switch]$FutureOnly) {
    foreach ($s in (SlotsFor $venueId $date)) {
        if ($s.status -ne 'AVAILABLE') { continue }
        if ($PastOnly -and -not ($date -eq $today -and $s.startTime -lt $nowTime)) { continue }
        if ($FutureOnly -and ($date -eq $today -and $s.startTime -lt $nowTime)) { continue }
        return $s
    }
    return $null
}

$vKick   = $venues | Where-Object { $_.slug -eq 'kick-off-arena' } | Select-Object -First 1
$vGreen  = $venues | Where-Object { $_.slug -eq 'greenturf-mohammadpur' } | Select-Object -First 1
$vMirpur = $venues | Where-Object { $_.slug -eq 'mirpur-sports-city' } | Select-Object -First 1
$vGulshan= $venues | Where-Object { $_.slug -eq 'gulshan-turf-park' } | Select-Object -First 1
if (-not $vKick) { $vKick = $venues[0] }
if (-not $vGreen) { $vGreen = $venues[1] }
if (-not $vMirpur) { $vMirpur = $venues[2] }
if (-not $vGulshan) { $vGulshan = $venues[3] }

# ── 3. Bookings ─────────────────────────────────────────────────────────────
Write-Host "`n-- bookings --" -ForegroundColor Yellow
$bookings = @()

function BookViaHold($session, $slot, $label) {
    $h = Auth $session.token
    $hold = Invoke-Api POST '/api/v1/bookings/hold-slot' @{ slotId = $slot.id } $h
    if (-not $hold.ok) { Step "book-$label-FAILED" "hold status=$($hold.status)"; return $null }
    $bk = Invoke-Api POST '/api/v1/bookings' @{ slotId = $slot.id } $h
    if (-not $bk.ok) { Step "book-$label-FAILED" "confirm status=$($bk.status)"; return $null }
    Step "booking" "$label id=$($bk.data.id) code=$($bk.data.bookingCode) date=$($bk.data.bookingDate) $($bk.data.startTime) status=$($bk.data.status)"
    return $bk.data
}
function BookViaCheckout($session, $slot, $label, $method) {
    $h = Auth $session.token
    $hold = Invoke-Api POST '/api/v1/bookings/hold-slot' @{ slotId = $slot.id } $h
    if (-not $hold.ok) { Step "checkout-$label-FAILED" "hold status=$($hold.status)"; return $null }
    $pay = Invoke-Api POST '/api/v1/payments/checkout' @{ slotId = $slot.id; method = $method; applyWalletAmount = 0 } $h
    if (-not $pay.ok) { Step "checkout-$label-FAILED" "status=$($pay.status) $($pay.raw)"; return $null }
    Step "checkout" "$label -> $($pay.data | ConvertTo-Json -Compress -Depth 4)"
    return $pay.data
}

# PAST slot today (deliberately exercises TC-009) — also yields a "completed" booking for reviews
$pastSlot = PickSlot $vKick.id $today -PastOnly
if ($pastSlot) {
    $b = BookViaHold $S.playerA $pastSlot 'playerA-PAST-today'
    if ($b) { $bookings += [pscustomobject]@{ label='playerA_past_completed'; owner='playerA'; id=$b.id; code=$b.bookingCode; venueId=$vKick.id; date=$b.bookingDate; start=$b.startTime; status=$b.status } }
} else { Step 'book-past' 'no past AVAILABLE slot today (run later in the day to exercise TC-009)' }

# Future confirmed booking (tomorrow)
$futSlot = PickSlot $vKick.id $tomorrow -FutureOnly
if ($futSlot) {
    $b = BookViaHold $S.playerA $futSlot 'playerA-upcoming'
    if ($b) { $bookings += [pscustomobject]@{ label='playerA_upcoming_confirmed'; owner='playerA'; id=$b.id; code=$b.bookingCode; venueId=$vKick.id; date=$b.bookingDate; start=$b.startTime; status=$b.status } }
}

# Second future booking then cancel -> CANCELLED state
$cancelSlot = SlotsFor $vKick.id $tomorrow | Where-Object { $_.status -eq 'AVAILABLE' } | Select-Object -Skip 1 -First 1
if ($cancelSlot) {
    $b = BookViaHold $S.playerA $cancelSlot 'playerA-to-cancel'
    if ($b) {
        $c = Invoke-Api POST "/api/v1/bookings/$($b.id)/cancel" $null (Auth $S.playerA.token)
        Step 'cancel' "booking $($b.id) cancel status=$($c.status)"
        $bookings += [pscustomobject]@{ label='playerA_cancelled'; owner='playerA'; id=$b.id; code=$b.bookingCode; venueId=$vKick.id; date=$b.bookingDate; start=$b.startTime; status='CANCELLED' }
    }
}

# Paid-by-checkout booking (produces a real payment row)
$paySlot = PickSlot $vGreen.id $tomorrow -FutureOnly
if ($paySlot) {
    $p = BookViaCheckout $S.playerA $paySlot 'playerA-paid-bkash' 'BKASH'
    if ($p) { $bookings += [pscustomobject]@{ label='playerA_paid_checkout'; owner='playerA'; id=$p.bookingId; code=$p.bookingCode; venueId=$vGreen.id; date=$paySlot.slotDate; start=$paySlot.startTime; status='CONFIRMED'; paymentId=$p.paymentId } }
}

# Player B booking (cross-user authorization target)
$bSlot = PickSlot $vMirpur.id $tomorrow -FutureOnly
if ($bSlot) {
    $b = BookViaHold $S.playerB $bSlot 'playerB-upcoming'
    if ($b) { $bookings += [pscustomobject]@{ label='playerB_upcoming_confirmed'; owner='playerB'; id=$b.id; code=$b.bookingCode; venueId=$vMirpur.id; date=$b.bookingDate; start=$b.startTime; status=$b.status } }
}

# ── 4. Saved venues ─────────────────────────────────────────────────────────
Write-Host "`n-- saved venues --" -ForegroundColor Yellow
foreach ($slug in @($vKick.slug, $vGulshan.slug)) {
    $r = Invoke-Api POST "/api/v1/players/me/saved-venues/$slug" $null (Auth $S.playerA.token)
    Step 'saved-venue' "playerA + $slug -> $($r.status) $($r.raw)"
}

# ── 5. Tournament registration (creates an UNPAID entry fee alongside 13 PAID) ─
Write-Host "`n-- tournament --" -ForegroundColor Yellow
$TOURN = 'TR-CUP-0091'
$reg = Invoke-Api POST "/api/v1/tournaments/$TOURN/register" @{
    teamName = 'QA Test United'; captainName = 'QA PlayerA Alpha'; contactPhone = '+8801900000001'
    skillLevel = 'INTERMEDIATE'; agreedToRules = $true
} (Auth $S.playerA.token)
$teamReg = $null
if ($reg.ok) { $teamReg = $reg.data; Step 'tournament' "playerA team id=$($teamReg.id) code=$($teamReg.registrationCode) fee=$($teamReg.entryFeeStatus)" }
else { Step 'tournament-FAILED' "status=$($reg.status) $($reg.raw)" }

# ── 6. Owner A workspace ────────────────────────────────────────────────────
Write-Host "`n-- owner workspace --" -ForegroundColor Yellow
$ownerAH = Auth $S.ownerA.token
$ovRes = Invoke-Api GET '/api/v1/owner/venues' $null $ownerAH
$ownerVenue = $null
if ($ovRes.ok -and $ovRes.data.Count -gt 0) { $ownerVenue = $ovRes.data[0] }
if (-not $ownerVenue) {
    $cv = Invoke-Api POST '/api/v1/owner/venues' @{
        name='QA Owner A Arena'; address='QA Road 1, Dhanmondi'; area='Dhanmondi'; lat=23.7461; lng=90.3742
        basePrice=2000; openTime='06:00'; closeTime='23:00'; amenities='floodlights,parking'
        contactPhone='+8801900000004'; contactEmail='qa.owner.a@turfchai.test'
        depositPolicy='FULL_ONLY'; cancelPolicy='FREE_24H_50_6H'; allowSplitPayment=$true
        rules='QA house rules'; mlPricingEnabled=$false
    } $ownerAH
    if ($cv.ok) { $ownerVenue = $cv.data }
}
Step 'owner-venue' "ownerA venue id=$($ownerVenue.id) name=$($ownerVenue.name) slug=$($ownerVenue.slug) status=$($ownerVenue.status)"

$pitch = $null
if ($ownerVenue) {
    $cp = Invoke-Api POST "/api/v1/owner/venues/$($ownerVenue.id)/pitches" @{
        name='QA Pitch 1'; format='7_a_side'; surfaceType='Artificial grass'; lighting='LED floodlights'
        maxPlayers=14; indoor=$false; sportSlugs=@('football')
    } $ownerAH
    # The create response body is not reliably parsed, so read the id back from the venue.
    $reread = Invoke-Api GET "/api/v1/owner/venues/$($ownerVenue.id)" $null $ownerAH
    if ($reread.ok) { $pitch = $reread.data.pitches | Where-Object { $_.name -eq 'QA Pitch 1' } | Select-Object -First 1 }
    if ($pitch) { Step 'owner-pitch' "pitch id=$($pitch.id) $($pitch.name) (create status=$($cp.status))" }
    else { Step 'owner-pitch-FAILED' "status=$($cp.status) $($cp.raw)" }

    $pr = Invoke-Api POST "/api/v1/owner/venues/$($ownerVenue.id)/pricing-rules" @{
        sportSlug='football'; windowType='PEAK'; rate=2500; slotDurationMin=90; bufferMin=10
        windowStart='16:00:00'; windowEnd='23:00:00'; daysOfWeek=@(1,2,3,4,5,6,7)
    } $ownerAH
    Step 'owner-pricing-rule' "status=$($pr.status)"
}

$ownerSlots = @()
if ($pitch) {
    $gen = Invoke-Api POST '/api/v1/owner/slots/generate' @{
        pitchId=$pitch.id; startDate=$today; endDate=$tomorrow
        startTime='08:00:00'; endTime='20:00:00'; slotDurationMinutes=120; basePrice=1800
    } $ownerAH
    if ($gen.ok) { $ownerSlots = $gen.data; Step 'owner-slots' "generated $($ownerSlots.Count) slots on QA pitch" }
    else { Step 'owner-slots-FAILED' "status=$($gen.status) $($gen.raw)" }
}

# Blocked slot state
$blocked = $null
if ($ownerSlots.Count -gt 0) {
    $target = $ownerSlots | Where-Object { $_.status -eq 'AVAILABLE' } | Select-Object -Last 1
    if ($target) {
        $bl = Invoke-Api POST "/api/v1/owner/venues/$($ownerVenue.id)/slots/$($target.id)/block" $null $ownerAH
        if ($bl.ok) { $blocked = $target; Step 'owner-block' "blocked slot id=$($target.id) $($target.startTime)" }
        else { Step 'owner-block-FAILED' "status=$($bl.status)" }
    }
}

# Booking against owner A's venue -> owner bookings + customers become non-empty
$ownerBooking = $null
if ($ownerSlots.Count -gt 0) {
    $free = $ownerSlots | Where-Object { $_.status -eq 'AVAILABLE' -and $_.startTime -ge '16:00' } | Select-Object -First 1
    if (-not $free) { $free = $ownerSlots | Where-Object { $_.status -eq 'AVAILABLE' } | Select-Object -First 1 }
    if ($free) {
        $b = BookViaHold $S.playerA @{ id = $free.id } 'playerA-at-ownerA-venue'
        if ($b) {
            $ownerBooking = $b
            $bookings += [pscustomobject]@{ label='playerA_at_ownerA_venue'; owner='playerA'; id=$b.id; code=$b.bookingCode; venueId=$ownerVenue.id; date=$b.bookingDate; start=$b.startTime; status=$b.status }
        }
    }
}

# Promotion
$promo = $null
if ($ownerVenue) {
    $pm = Invoke-Api POST "/api/v1/owner/venues/$($ownerVenue.id)/promotions" @{
        code='QA20'; label='QA 20% off'; discountType='PERCENT'; discountValue=20
        minOrderAmount=0; usageLimit=100
        validFrom=(Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        validUntil=(Get-Date).AddDays(30).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    } $ownerAH
    if ($pm.ok) { $promo = $pm.data; Step 'owner-promotion' "promo id=$($promo.id) code=$($promo.code)" }
    else { Step 'owner-promotion-FAILED' "status=$($pm.status) $($pm.raw)" }
}

# Owner B (cross-owner isolation target)
$ownerBH = Auth $S.ownerB.token
$obRes = Invoke-Api GET '/api/v1/owner/venues' $null $ownerBH
$ownerBVenue = if ($obRes.ok -and $obRes.data.Count -gt 0) { $obRes.data[0] } else { $null }
Step 'owner-b-venue' "ownerB venue id=$($ownerBVenue.id) name=$($ownerBVenue.name)"

# ── 7. Open game ────────────────────────────────────────────────────────────
Write-Host "`n-- open game --" -ForegroundColor Yellow
$openGame = $null
$og = Invoke-Api POST '/api/v1/solo/open-games' @{
    title='QA Friendly Match'; venueId=$vKick.id; gameDate=$tomorrow
    startTime='19:00:00'; endTime='20:30:00'; skillLevel='INTERMEDIATE'
    capacity=10; pricePerPlayer=250; organizerUserId=$S.playerA.user.id
} (Auth $S.playerA.token)
if ($og.ok) { $openGame = $og.data; Step 'open-game' "id=$($openGame.id) code=$($openGame.gameCode) spots=$($openGame.spotsLeft)" }
else { Step 'open-game-FAILED' "status=$($og.status) $($og.raw)" }

if ($openGame) {
    $join = Invoke-Api POST "/api/v1/solo/open-games/$($openGame.id)/join" @{ userId = $S.playerB.user.id; paymentMethod = 'bKash' } (Auth $S.playerB.token)
    Step 'open-game-join' "playerB join -> $($join.status) $($join.raw)"
}

# ── 8. Review attempt (expected to expose TC-005) ───────────────────────────
Write-Host "`n-- review --" -ForegroundColor Yellow
$reviewTarget = $bookings | Where-Object { $_.label -eq 'playerA_past_completed' } | Select-Object -First 1
if (-not $reviewTarget) { $reviewTarget = $bookings | Where-Object { $_.owner -eq 'playerA' } | Select-Object -First 1 }
$reviewResult = $null
if ($reviewTarget) {
    $rv = Invoke-Api POST '/api/v1/reviews' @{
        bookingId=$reviewTarget.id; userId=$S.playerA.user.id; venueId=$reviewTarget.venueId
        overallRating=5; subRatings=@{ surface=5; lighting=4 }; comment='QA baseline review'; parentReview=$false
    } (Auth $S.playerA.token)
    $reviewResult = @{ status = $rv.status; body = "$($rv.raw)" }
    Step 'review' "booking $($reviewTarget.id) -> status=$($rv.status)"
}

# ── 9. Rewards ──────────────────────────────────────────────────────────────
Write-Host "`n-- rewards --" -ForegroundColor Yellow
$pts = Invoke-Api GET '/api/v1/rewards/my-points' $null (Auth $S.demoPlayer.token)
Step 'rewards' "demoPlayer balance=$($pts.data.data.balance) tier=$($pts.data.data.currentTier.name)"
$prod = Invoke-Api GET '/api/v1/rewards/products'
$redeemable = $prod.data.data | Where-Object { $_.costPoints -le $pts.data.data.balance } | Select-Object -First 1
$redemption = $null
if ($redeemable) {
    $rd = Invoke-Api POST '/api/v1/rewards/redeem' @{ rewardId = $redeemable.id } (Auth $S.demoPlayer.token)
    if ($rd.ok) { $redemption = $rd.data.data; Step 'rewards-redeem' "redeemed rewardId=$($redeemable.id) -> $($rd.data.data | ConvertTo-Json -Compress -Depth 4)" }
    else { Step 'rewards-redeem-FAILED' "status=$($rd.status) $($rd.raw)" }
}

# ── 10. Manifest ────────────────────────────────────────────────────────────
$manifest = [ordered]@{
    generatedAt   = (Get-Date).ToString('o')
    baseUrl       = $BaseUrl
    commit        = (git -C "$PSScriptRoot\.." rev-parse HEAD 2>$null)
    profile       = 'dev (in-memory H2, Flyway disabled, seeders enabled)'
    qaPassword    = $QA_PASSWORD
    seededAccounts = $SEEDED
    qaAccounts    = @($ACCOUNTS | ForEach-Object {
        $sess = $S[$_.key]
        [ordered]@{ key=$_.key; email=$_.email; password=$QA_PASSWORD; role=$_.role
                    id=$sess.user.id; publicId=$sess.user.publicId }
    })
    demoPlayer    = [ordered]@{ email=$SEEDED.demoPlayer.email; id=$S.demoPlayer.user.id; publicId=$S.demoPlayer.user.publicId }
    superAdmin    = [ordered]@{ email=$SEEDED.superAdmin.email; id=$S.superAdmin.user.id; role=$S.superAdmin.user.role }
    venues        = @($venues | ForEach-Object { [ordered]@{ id=$_.id; slug=$_.slug; name=$_.name; area=$_.area } })
    ownerAVenue   = if ($ownerVenue) { [ordered]@{ id=$ownerVenue.id; name=$ownerVenue.name; slug=$ownerVenue.slug; status=$ownerVenue.status; pitchId=$pitch.id } } else { $null }
    ownerBVenue   = if ($ownerBVenue) { [ordered]@{ id=$ownerBVenue.id; name=$ownerBVenue.name; slug=$ownerBVenue.slug } } else { $null }
    ownerSlots    = @($ownerSlots | ForEach-Object { [ordered]@{ id=$_.id; date=$_.slotDate; start=$_.startTime; status=$_.status; price=$_.price } })
    blockedSlotId = $blocked.id
    promotion     = if ($promo) { [ordered]@{ id=$promo.id; code=$promo.code; venueId=$ownerVenue.id } } else { $null }
    bookings      = @($bookings)
    tournament    = [ordered]@{ code=$TOURN; qaTeamId=$teamReg.id; qaRegistrationCode=$teamReg.registrationCode; qaEntryFeeStatus=$teamReg.entryFeeStatus }
    openGame      = if ($openGame) { [ordered]@{ id=$openGame.id; code=$openGame.gameCode; venueId=$vKick.id } } else { $null }
    reviewAttempt = $reviewResult
    rewards       = [ordered]@{ demoPlayerBalance=$pts.data.data.balance; redemption=$redemption }
    steps         = @($script:Steps)
}

New-Item -ItemType Directory -Force -Path (Split-Path $OutFile) | Out-Null
$manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $OutFile -Encoding UTF8
Write-Host "`nManifest written to $OutFile" -ForegroundColor Green
Write-Host ("Accounts: {0} | Bookings: {1} | OwnerSlots: {2}" -f $ACCOUNTS.Count, $bookings.Count, $ownerSlots.Count) -ForegroundColor Green
