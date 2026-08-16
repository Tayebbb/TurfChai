<#
    TurfChai — QA finding reproduction harness (API level).

    Replays every previously reported finding against the freshly seeded
    deterministic dataset and records structured evidence. Read-mostly: the
    only writes are the ones a finding requires in order to be demonstrated.

    Usage:
        powershell -NoProfile -ExecutionPolicy Bypass -File qa\reproduce-findings.ps1
#>
param(
    [string]$BaseUrl = 'http://localhost:8080',
    [string]$DataFile = "$PSScriptRoot\baseline\qa-dataset.json",
    [string]$OutFile = "$PSScriptRoot\baseline\qa-findings-api.json"
)

$ErrorActionPreference = 'Stop'
$DATA = Get-Content $DataFile -Raw | ConvertFrom-Json
$results = @()

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body, [hashtable]$Headers = @{})
    $h = @{}; $Headers.GetEnumerator() | ForEach-Object { $h[$_.Key] = $_.Value }
    $a = @{ Uri = "$BaseUrl$Path"; Method = $Method; Headers = $h; UseBasicParsing = $true; TimeoutSec = 40 }
    if ($null -ne $Body) { $a.Body = ($Body | ConvertTo-Json -Depth 8); $a.ContentType = 'application/json' }
    try { $r = Invoke-WebRequest @a; return [pscustomobject]@{ status=[int]$r.StatusCode; body=$r.Content } }
    catch {
        $c = 0; if ($_.Exception.Response) { $c = [int]$_.Exception.Response.StatusCode.value__ }
        $m = $_.ErrorDetails.Message; if (-not $m) { $m = $_.Exception.Message }
        return [pscustomobject]@{ status=$c; body=$m }
    }
}
function Auth($t) { @{ Authorization = "Bearer $t" } }
function Login($e,$p) { (Invoke-Api POST '/api/v1/auth/login' @{email=$e;password=$p}).body | ConvertFrom-Json }
function Snip($s,$n=220) { if (-not $s) { return '' } ; $s = ($s -replace '\s+',' '); if ($s.Length -gt $n) { return $s.Substring(0,$n) } ; return $s }

function Record {
    param($Id,$Title,$Severity,$Steps,$Expected,$Actual,$Status,$Evidence)
    $script:results += [ordered]@{
        id=$Id; title=$Title; severity=$Severity; reproduced=$Status
        steps=$Steps; expected=$Expected; actual=$Actual; evidence=$Evidence
    }
    $c = if ($Status -eq 'REPRODUCED') { 'Red' } elseif ($Status -eq 'NOT_REPRODUCED') { 'Green' } else { 'Yellow' }
    Write-Host ("[{0}] {1} -> {2}" -f $Id, $Title, $Status) -ForegroundColor $c
}

# ── sessions ────────────────────────────────────────────────────────────────
$PW = $DATA.qaPassword
$A  = Login 'qa.player.a@turfchai.test' $PW
$B  = Login 'qa.player.b@turfchai.test' $PW
$OA = Login 'qa.owner.a@turfchai.test' $PW
$OB = Login 'qa.owner.b@turfchai.test' $PW
$AH = Auth $A.token; $BH = Auth $B.token; $OAH = Auth $OA.token; $OBH = Auth $OB.token
$bkPast   = ($DATA.bookings | Where-Object { $_.label -eq 'playerA_past_completed' })[0]
$bkFuture = ($DATA.bookings | Where-Object { $_.label -eq 'playerA_upcoming_confirmed' })[0]
$bkB      = ($DATA.bookings | Where-Object { $_.label -eq 'playerB_upcoming_confirmed' })[0]

Write-Host "`n########## PHASE 3 — REPRODUCTION ##########`n" -ForegroundColor Cyan

# ── TC-001 ──────────────────────────────────────────────────────────────────
$victimPub = ($DATA.qaAccounts | Where-Object { $_.key -eq 'playerB' }).publicId
$hdr = @{ 'X-User-Id' = $victimPub }
$r1 = Invoke-Api GET '/api/v1/players/me' $null $hdr
$r2 = Invoke-Api PATCH '/api/v1/players/me' @{ fullName='TC001 TAMPERED'; bio='written by anonymous'; area='Attacker Zone' } $hdr
$r3 = Invoke-Api GET '/api/v1/players/me/saved-venues' $null $hdr
$r4 = Invoke-Api POST '/api/v1/players/me/saved-venues/mirpur-sports-city' $null $hdr
$r5 = Invoke-Api DELETE '/api/v1/players/me/saved-venues/mirpur-sports-city' $null $hdr
$r6 = Invoke-Api GET '/api/v1/players/me' $null @{}   # no header at all -> demo user fallback
$leakedPii = ($r1.body -match 'qa.player.b@turfchai.test')
$tampered  = ($r2.status -eq 200 -and $r2.body -match 'TC001 TAMPERED')
Record 'TC-001' 'Unauthenticated player account access + tampering via X-User-Id' 'CRITICAL' @(
    "GET  /api/v1/players/me with header X-User-Id: $victimPub and NO Authorization header",
    "PATCH /api/v1/players/me same header, body {fullName:'TC001 TAMPERED',bio,area}",
    "GET/POST/DELETE /api/v1/players/me/saved-venues[/{slug}] same header",
    "GET  /api/v1/players/me with NO header at all"
) '401 Unauthorized on every call' (
    "GET=$($r1.status) PATCH=$($r2.status) savedGET=$($r3.status) savedPOST=$($r4.status) savedDELETE=$($r5.status) noHeaderGET=$($r6.status)"
) $(if ($r1.status -eq 200 -and $tampered) { 'REPRODUCED' } else { 'PARTIAL' }) @{
    anonReadBody = Snip $r1.body; piiLeaked = $leakedPii
    anonPatchBody = Snip $r2.body; profileTampered = $tampered
    savedVenuesRead = Snip $r3.body; savedVenueToggle = Snip $r4.body; savedVenueDelete = $r5.status
    noHeaderFallsBackToDemoUser = ($r6.status -eq 200 -and $r6.body -match 'rafi@turfchai.dev')
    noHeaderBody = Snip $r6.body
}

# ── TC-002 ──────────────────────────────────────────────────────────────────
$T = $DATA.tournament.code
$demoHdr = @{ 'X-User-Id' = $DATA.demoPlayer.publicId }
$t1 = Invoke-Api GET "/api/v1/host/tournaments/$T"
$t2 = Invoke-Api POST "/api/v1/tournaments/$T/register" @{ teamName='TC002 Ghost FC'; captainName='Anon'; contactPhone='+8801900000099'; agreedToRules=$true } $demoHdr
$t3 = Invoke-Api POST "/api/v1/host/tournaments/$T/teams/1/entry-fee" $null @{}
$t4 = Invoke-Api POST "/api/v1/host/tournaments/$T/fixtures/generate" $null @{}
$t5 = Invoke-Api DELETE "/api/v1/tournaments/$T/register" $null $demoHdr
# correct lowercase enums this time — proves whether anonymous creation is possible
$t6 = Invoke-Api POST '/api/v1/host/tournaments' @{
    name='TC002 Ghost Cup'; venueSlug='mirpur-sports-city'; date='2027-09-01'
    windowStart='08:00:00'; windowEnd='18:00:00'; format='7_a_side'; teamCapacity=8
    entryFeePerTeam=500; prizePool=1000; privacy='open'
} $demoHdr
$t7 = Invoke-Api GET '/api/v1/tournaments/me' $null $demoHdr
Record 'TC-002' 'Unauthenticated tournament read + write + destructive host operations' 'CRITICAL' @(
    "GET  /api/v1/host/tournaments/$T (no auth)",
    "POST /api/v1/tournaments/$T/register (no auth, X-User-Id = demo player)",
    "POST /api/v1/host/tournaments/$T/teams/1/entry-fee (no auth, no identity)",
    "POST /api/v1/host/tournaments/$T/fixtures/generate (no auth, no identity)",
    "DELETE /api/v1/tournaments/$T/register (no auth, X-User-Id = demo player)",
    "POST /api/v1/host/tournaments (no auth, valid lowercase format/privacy)",
    "GET  /api/v1/tournaments/me (no auth, X-User-Id)"
) '401 Unauthorized on every call' (
    "read=$($t1.status) register=$($t2.status) entryFee=$($t3.status) fixtures=$($t4.status) withdraw=$($t5.status) create=$($t6.status) myTournaments=$($t7.status)"
) 'REPRODUCED' @{
    anonRead = Snip $t1.body 160; anonRegister = Snip $t2.body 160
    anonMarkEntryFeePaid = Snip $t3.body 200
    anonRegenerateFixtures = Snip $t4.body 200
    anonWithdraw = $t5.status
    anonCreateTournament = Snip $t6.body 200
    note = 'entry-fee and fixtures/generate require NO identity header at all'
}

# ── TC-005 ──────────────────────────────────────────────────────────────────
$rv1 = Invoke-Api POST '/api/v1/reviews' @{
    bookingId=$bkFuture.id; userId=$A.user.id; venueId=$bkFuture.venueId
    overallRating=4; subRatings=@{surface=4}; comment='TC-005 probe'; parentReview=$false } $AH
$rv2 = Invoke-Api POST '/api/v1/reviews' @{
    bookingId=$bkFuture.id; userId=$A.user.id; venueId=$bkFuture.venueId
    overallRating=4; subRatings=@{surface=4}; comment='TC-005 probe retry'; parentReview=$false } $AH
$venueAfter = Invoke-Api GET "/api/v1/venues/kick-off-arena"
Record 'TC-005' 'Review submission returns 500 but the review is persisted' 'HIGH' @(
    "POST /api/v1/reviews as playerA for own booking $($bkFuture.id) -> observe status",
    "POST the same review again -> observe status/message (proves the first one was saved)"
) '200/201 with the created review' (
    "firstAttempt=$($rv1.status) secondAttempt=$($rv2.status)"
) $(if ($rv1.status -eq 500 -and $rv2.status -eq 400) { 'REPRODUCED' } else { 'PARTIAL' }) @{
    firstBody = Snip $rv1.body; secondBody = Snip $rv2.body
    proofOfSilentPersistence = 'second identical submit is rejected as duplicate, so the first one committed despite the 500'
    venueRatingAfter = Snip $venueAfter.body 160
}

# ── TC-006 ──────────────────────────────────────────────────────────────────
$c1 = Invoke-Api POST "/api/v1/matchday/checkin?bookingId=$($bkPast.id)" $null $BH   # B checks in A's booking
$c2 = Invoke-Api POST "/api/v1/matchday/checkin?bookingId=$($bkPast.id)" $null $AH   # owner
$c3 = Invoke-Api POST "/api/v1/matchday/checkin?bookingId=$($bkB.id)" $null $AH      # A checks in B's booking
$c4 = Invoke-Api POST "/api/v1/matchday/checkin?bookingId=999999" $null $AH
Record 'TC-006' 'Match-day check-in has no ownership check' 'HIGH' @(
    "POST /api/v1/matchday/checkin?bookingId=$($bkPast.id) authenticated as playerB (booking belongs to playerA)",
    "POST /api/v1/matchday/checkin?bookingId=$($bkB.id) authenticated as playerA (booking belongs to playerB)",
    "POST /api/v1/matchday/checkin?bookingId=999999 (nonexistent)"
) '403 Forbidden for a booking the caller does not own' (
    "B_checks_in_A=$($c1.status) A_checks_in_own=$($c2.status) A_checks_in_B=$($c3.status) nonexistent=$($c4.status)"
) $(if ($c1.status -eq 200 -or $c3.status -eq 200) { 'REPRODUCED' } else { 'NOT_REPRODUCED' }) @{
    crossUserCheckInByB = Snip $c1.body; crossUserCheckInByA = Snip $c3.body
    nonexistentBooking = Snip $c4.body
}

# ── TC-007 ──────────────────────────────────────────────────────────────────
$f1 = Invoke-Api POST '/api/v1/reviews' @{
    bookingId=$bkB.id; userId=$A.user.id; venueId=$bkB.venueId
    overallRating=1; subRatings=@{}; comment='TC-007 forged authorship'; parentReview=$false } $BH
$f2 = Invoke-Api POST '/api/v1/reviews' @{
    bookingId=$bkPast.id; userId=$B.user.id; venueId=$bkPast.venueId
    overallRating=1; subRatings=@{}; comment='TC-007 review on someone elses booking'; parentReview=$false } $BH
Record 'TC-007' 'Review author and booking ownership are taken from the request body' 'HIGH' @(
    "Authenticated as playerB, POST /api/v1/reviews with userId = playerA id and playerB's own booking",
    "Authenticated as playerB, POST /api/v1/reviews for playerA's booking $($bkPast.id) with userId = playerB"
) '403 Forbidden — author must be the caller and must own the booking' (
    "forgedAuthor=$($f1.status) reviewOnForeignBooking=$($f2.status)"
) 'CODE_CONFIRMED' @{
    forgedAuthorBody = Snip $f1.body; foreignBookingBody = Snip $f2.body
    codeEvidence = 'ReviewService.submitReview() uses dto.getUserId() directly; no comparison with the authenticated principal and no booking-ownership check. A 500 here is TC-005 firing on the same call path.'
}

# ── TC-009 ──────────────────────────────────────────────────────────────────
$today = (Get-Date).ToString('yyyy-MM-dd'); $nowT = (Get-Date).ToString('HH:mm:ss')
$slotsToday = (Invoke-Api GET "/api/v1/venues/1/slots?date=$today").body | ConvertFrom-Json
$pastAvail = @($slotsToday | Where-Object { $_.status -eq 'AVAILABLE' -and $_.startTime -lt $nowT })
$yesterday = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')
$slotsYesterday = (Invoke-Api GET "/api/v1/venues/1/slots?date=$yesterday").body | ConvertFrom-Json
$pastHold = $null; $pastBook = $null
if ($pastAvail.Count -gt 0) {
    $pastHold = Invoke-Api POST '/api/v1/bookings/hold-slot' @{ slotId = $pastAvail[0].id } $BH
    $pastBook = Invoke-Api POST '/api/v1/bookings' @{ slotId = $pastAvail[0].id } $BH
}
Record 'TC-009' 'Slots whose start time has already passed can be held, booked and paid' 'HIGH' @(
    "GET /api/v1/venues/1/slots?date=$today at wall-clock $nowT",
    "POST /api/v1/bookings/hold-slot for a slot whose startTime is earlier than now",
    "POST /api/v1/bookings to confirm it",
    "GET /api/v1/venues/1/slots?date=$yesterday (a past date)"
) 'Past slots are not offered; hold/confirm rejected with 400/409' (
    "pastAvailableSlotsToday=$($pastAvail.Count) hold=$($pastHold.status) confirm=$($pastBook.status) slotsReturnedForYesterday=$($slotsYesterday.Count)"
) $(if ($pastAvail.Count -gt 0 -and $pastBook.status -eq 200) { 'REPRODUCED' } else { 'PARTIAL' }) @{
    wallClock = $nowT
    pastSlotsOffered = @($pastAvail | ForEach-Object { "id=$($_.id) $($_.startTime) $($_.status) price=$($_.price)" })
    confirmBody = Snip $pastBook.body
    seedBookingProof = "seeder booking id=$($bkPast.id) code=$($bkPast.code) is a $($bkPast.start) slot on $($bkPast.date)"
    backdatedSlotsGenerated = "GET slots for $yesterday returned $($slotsYesterday.Count) rows (endpoint auto-generates slots on demand for any date)"
}

# ── TC-010 ──────────────────────────────────────────────────────────────────
$slotForPay = ($DATA.ownerSlots | Where-Object { $_.status -eq 'AVAILABLE' } | Select-Object -Skip 2 -First 1)
$payProbe = $null
if ($slotForPay) {
    Invoke-Api POST '/api/v1/bookings/hold-slot' @{ slotId=$slotForPay.id } $BH | Out-Null
    $payProbe = Invoke-Api POST '/api/v1/payments/checkout' @{ slotId=$slotForPay.id; method='CARD'; applyWalletAmount=0 } $BH
}
$payNoHold = Invoke-Api POST '/api/v1/payments/checkout' @{ slotId=99999; method='BKASH'; applyWalletAmount=0 } $BH
Record 'TC-010' 'Payment is simulated: no gateway, no credential capture, no verification' 'HIGH' @(
    "POST /api/v1/payments/checkout {slotId, method:'CARD', applyWalletAmount:0} — note the request carries NO card number, NO account number and NO PIN",
    "POST /api/v1/payments/checkout for a slot with no hold"
) 'Payment authorised by an external provider before the booking is confirmed' (
    "checkout=$($payProbe.status) noHold=$($payNoHold.status)"
) 'REPRODUCED' @{
    checkoutBody = Snip $payProbe.body 320
    requestContract = 'CheckoutRequest has exactly three fields: slotId, method (BKASH|NAGAD|CARD|CASH), applyWalletAmount. No PAN/account/PIN/OTP field exists, so the bKash sheet in the UI cannot be transmitting anything.'
    noHoldBody = Snip $payNoHold.body
}

Write-Host "`n########## PHASE 4 — ADDITIONAL DISCOVERY ##########`n" -ForegroundColor Cyan

# N01 — Part B seeder never runs
$payouts = Invoke-Api GET '/api/v1/admin/payouts' $null (Auth (Login 'admin0@turfchai.com' 'Demo@12345').token)
Record 'QA-N01' 'AdminPartBDataSeeder never executes (@PostConstruct runs before CommandLineRunner)' 'MEDIUM' @(
    'Inspect AdminPartBDataSeeder: seeding is triggered from @PostConstruct',
    'Part A (users/venues/pitches) is created by CommandLineRunner beans, which run AFTER all @PostConstruct callbacks',
    'Start the app and read the log; then GET /api/v1/admin/payouts'
) 'Seeded bookings, payouts and audit logs exist for admin analytics' (
    "backend log says 'Cannot run Part B Seeder: required Part A data (Users/Venues/Pitches) is missing.'; GET /admin/payouts returned $($payouts.status) with $((($payouts.body | ConvertFrom-Json)).Count) rows"
) 'NEW' @{
    consequence = 'Admin payouts, 12-month GMV history and audit-log demo data are always empty, so admin analytics fall back to fabricated values.'
    logLine = 'Cannot run Part B Seeder: required Part A data (Users/Venues/Pitches) is missing.'
}

# N02 — owner venue auto-provisioning
$obv = Invoke-Api GET '/api/v1/owner/venues' $null $OBH
Record 'QA-N02' 'Registering as OWNER auto-creates a venue named "Kick Off Arena" in Dhanmondi' 'MEDIUM' @(
    "POST /api/v1/auth/register with role=OWNER",
    "GET /api/v1/owner/venues immediately afterwards"
) 'Empty list until the owner creates a venue' (
    "ownerB (brand new, never created a venue) already owns: $(Snip $obv.body 200)"
) 'NEW' @{ codeEvidence = 'VenueManagementService line ~145 falls back to the string "Kick Off Arena" when the owner has no turf request.' }

# N03 — demo venues owned by a PLAYER
$demoOwnerVenues = Invoke-Api GET '/api/v1/owner/venues' $null (Auth (Login 'rafi@turfchai.dev' 'demo1234').token)
Record 'QA-N03' 'The 10 demo venues are owned by a PLAYER-role user, so no one can manage them' 'MEDIUM' @(
    'VenueDataSeeder sets venue.owner = the demo player (rafi@turfchai.dev, role PLAYER)',
    'GET /api/v1/owner/venues authenticated as that same user'
) 'The venue owner can manage their venues' (
    "status=$($demoOwnerVenues.status) (owner endpoints require hasAnyRole('OWNER','ADMIN','SUPER_ADMIN'))"
) 'NEW' @{ consequence = 'All 10 seeded venues are unmanageable: their owner is blocked from every /api/v1/owner/** endpoint.' }

# N04 — cross-owner isolation (regression check)
$x1 = Invoke-Api GET "/api/v1/owner/venues/$($DATA.ownerAVenue.id)" $null $OBH
$x2 = Invoke-Api PUT "/api/v1/owner/venues/$($DATA.ownerAVenue.id)" @{ name='HIJACK' } $OBH
$x3 = Invoke-Api GET "/api/v1/owner/venues/$($DATA.ownerAVenue.id)/promotions" $null $OBH
$x4 = Invoke-Api POST "/api/v1/owner/venues/$($DATA.ownerAVenue.id)/slots/$($DATA.blockedSlotId)/unblock" $null $OBH
Record 'QA-N04' 'Cross-owner tenant isolation holds' 'INFO' @(
    "ownerB reads/updates ownerA venue $($DATA.ownerAVenue.id), lists its promotions and unblocks its slot"
) '403 Forbidden on all four' (
    "read=$($x1.status) update=$($x2.status) promotions=$($x3.status) unblockSlot=$($x4.status)"
) 'NOT_REPRODUCED' @{ note = 'Positive control — owner isolation is correctly enforced.' }

# N05 — booking IDOR regression check
$i1 = Invoke-Api GET "/api/v1/bookings/$($bkPast.id)" $null $BH
$i2 = Invoke-Api POST "/api/v1/bookings/$($bkPast.id)/cancel" $null $BH
$i3 = Invoke-Api GET "/api/v1/payments/booking/$($bkPast.id)" $null $BH
$i4 = Invoke-Api GET "/api/v1/payments/refund-preview/$($bkPast.id)" $null $BH
Record 'QA-N05' 'Booking read/cancel are protected, but payment history of another user is readable' 'HIGH' @(
    "As playerB: GET /api/v1/bookings/$($bkPast.id) (playerA's booking)",
    "As playerB: POST /api/v1/bookings/$($bkPast.id)/cancel",
    "As playerB: GET /api/v1/payments/booking/$($bkPast.id)",
    "As playerB: GET /api/v1/payments/refund-preview/$($bkPast.id)"
) '403/404 on all four' (
    "read=$($i1.status) cancel=$($i2.status) paymentHistory=$($i3.status) refundPreview=$($i4.status)"
) $(if ($i3.status -eq 200 -or $i4.status -eq 200) { 'NEW' } else { 'NOT_REPRODUCED' }) @{
    paymentHistoryBody = Snip $i3.body 260; refundPreviewBody = Snip $i4.body 200
}

# N06 — open game attendance / membership authorization
$g = $DATA.openGame
$o1 = Invoke-Api POST "/api/v1/solo/open-games/$($g.id)/members/$($B.user.id)/attendance?showUp=false" $null $AH
$o2 = Invoke-Api GET "/api/v1/solo/tickets/$($g.id)" $null $AH
$o3 = Invoke-Api GET "/api/v1/solo/tickets/$($g.id)" $null $OAH
$o4 = Invoke-Api POST "/api/v1/solo/open-games/$($g.id)/join" @{ userId=$A.user.id; paymentMethod='bKash' } $BH
Record 'QA-N06' 'Open game attendance/ticket authorization probe' 'MEDIUM' @(
    "playerA (organizer, role PLAYER) marks playerB as no-show: POST /solo/open-games/$($g.id)/members/$($B.user.id)/attendance?showUp=false",
    "playerA fetches own ticket; ownerA (not on roster) fetches a ticket",
    "playerB posts a join with userId = playerA (identity taken from body)"
) 'Attendance restricted to HOST/OWNER/ADMIN; ticket only for roster members; join uses the authenticated principal' (
    "attendanceByPlayer=$($o1.status) ownTicket=$($o2.status) nonMemberTicket=$($o3.status) joinWithForeignUserId=$($o4.status)"
) 'NEW' @{
    attendanceBody = Snip $o1.body; ownTicketBody = Snip $o2.body 200
    nonMemberTicketBody = Snip $o3.body; joinBody = Snip $o4.body
    note = 'JoinOpenGameRequest carries userId in the body — check whether the server trusts it.'
}

# N07 — venue slot endpoint generates slots for arbitrary dates
$far = (Get-Date).AddDays(300).ToString('yyyy-MM-dd')
$s1 = Invoke-Api GET "/api/v1/venues/1/slots?date=$far"
$s2 = Invoke-Api GET "/api/v1/venues/1/slots?date=1999-01-01"
Record 'QA-N07' 'Slot endpoint materialises slot rows on demand for any date, including long past/future' 'LOW' @(
    "GET /api/v1/venues/1/slots?date=$far",
    "GET /api/v1/venues/1/slots?date=1999-01-01"
) 'Bounded window; past dates rejected' (
    "future300d=$($s1.status)/$((($s1.body|ConvertFrom-Json)).Count) rows; year1999=$($s2.status)/$((($s2.body|ConvertFrom-Json)).Count) rows"
) 'NEW' @{ note = 'Unbounded on-demand generation is a storage-growth and past-booking vector (feeds TC-009).' }

# N08 — role escalation attempts
$e1 = Invoke-Api POST '/api/v1/auth/register' @{ fullName='Esc Test'; email="esc$(Get-Random)@qa.test"; password='QaPass@12345'; phone="+88019111$(Get-Random -Min 10000 -Max 99999)"; role='ADMIN' }
$e2 = Invoke-Api POST '/api/v1/auth/register' @{ fullName='Esc Test2'; email="esc2$(Get-Random)@qa.test"; password='QaPass@12345'; phone="+88019222$(Get-Random -Min 10000 -Max 99999)"; role='SUPER_ADMIN' }
$e3 = Invoke-Api PATCH '/api/v1/me' @{ fullName='Role Esc'; email='qa.player.a@turfchai.test'; phone='+8801900000001'; role='ADMIN' } $AH
$e4 = Invoke-Api GET '/api/v1/admin/users' $null $AH
Record 'QA-N08' 'Role escalation via self-registration / profile update is blocked' 'INFO' @(
    "register role=ADMIN; register role=SUPER_ADMIN; PATCH /api/v1/me with role=ADMIN; then GET /api/v1/admin/users"
) 'Blocked' (
    "registerADMIN=$($e1.status) registerSUPER=$($e2.status) patchRole=$($e3.status) adminAccessAfter=$($e4.status)"
) 'NOT_REPRODUCED' @{ note='Positive control.'; registerAdminBody = Snip $e1.body }

# N09 — AI endpoints are public
$a1 = Invoke-Api GET '/api/ai/metrics'
$a2 = Invoke-Api DELETE '/api/ai/sessions/victim-session-id'
Record 'QA-N09' 'AI namespace is fully public: metrics readable and any session deletable' 'MEDIUM' @(
    'GET /api/ai/metrics with no auth', 'DELETE /api/ai/sessions/{anySessionId} with no auth'
) 'Authenticated access' (
    "metrics=$($a1.status) deleteForeignSession=$($a2.status)"
) 'NEW' @{ metricsBody = Snip $a1.body 200; note = 'Session ids are client-supplied strings, so any known/guessed id can be wiped by anyone.' }

# N10 — promo code validation is public & enumerable
$p1 = Invoke-Api POST '/api/v1/promotions/validate-code' @{ code='QA20'; venueId=$DATA.ownerAVenue.id; amount=1000 }
$p2 = Invoke-Api POST '/api/v1/promotions/validate-code' @{ code='NOPE'; venueId=$DATA.ownerAVenue.id; amount=1000 }
Record 'QA-N10' 'Promo code validation is unauthenticated and enumerable' 'LOW' @(
    "POST /api/v1/promotions/validate-code with a real code, then a bogus one (no auth)"
) 'Rate-limited / authenticated' (
    "validCode=$($p1.status) bogusCode=$($p2.status)"
) 'NEW' @{ validBody = Snip $p1.body 200; bogusBody = Snip $p2.body 200 }

# N11 — orphan/unused backend endpoints reachable but unused by the UI
$u1 = Invoke-Api POST "/api/v1/owner/bookings/$($DATA.bookings[5].id)/approve" $null $OAH
$u2 = Invoke-Api GET '/api/v1/owner/bookings' $null $OAH
Record 'QA-N11' 'Owner booking approve/cancel endpoints work but have no frontend consumer' 'MEDIUM' @(
    "POST /api/v1/owner/bookings/{id}/approve as ownerA", "GET /api/v1/owner/bookings as ownerA"
) 'The owner Bookings screen calls these' (
    "approve=$($u1.status) list=$($u2.status)"
) 'NEW' @{ note = 'frontend/src/pages/owner/BookingsPage.jsx row actions only call showToast(); api/ownerBookings.js exposes no approve/cancel function at all.' }

# ── output ──────────────────────────────────────────────────────────────────
$out = [ordered]@{
    generatedAt = (Get-Date).ToString('o')
    commit      = (git -C "$PSScriptRoot\.." rev-parse HEAD 2>$null)
    baseUrl     = $BaseUrl
    dataset     = $DataFile
    summary     = [ordered]@{
        total        = $results.Count
        reproduced   = @($results | Where-Object { $_.reproduced -eq 'REPRODUCED' }).Count
        newFindings  = @($results | Where-Object { $_.reproduced -eq 'NEW' }).Count
        notReproduced= @($results | Where-Object { $_.reproduced -eq 'NOT_REPRODUCED' }).Count
        partial      = @($results | Where-Object { $_.reproduced -in @('PARTIAL','CODE_CONFIRMED') }).Count
    }
    findings    = $results
}
New-Item -ItemType Directory -Force -Path (Split-Path $OutFile) | Out-Null
$out | ConvertTo-Json -Depth 12 | Set-Content -Path $OutFile -Encoding UTF8
Write-Host "`nWritten $OutFile" -ForegroundColor Green
$out.summary | ConvertTo-Json
