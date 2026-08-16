# Multi-role end-to-end QA harness.
#
# Signs in as every role the product has, drives each role's real workflows
# against the running backend, and then runs the cross-role attack matrix:
# every role is pointed at every other role's data and must be refused.
#
# Usage:  powershell -ExecutionPolicy Bypass -File qa/qa-all-roles.ps1

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$api = 'http://localhost:8080/api/v1'

$script:pass = 0
$script:failures = @()
$script:skips = @()

function Section($name) { Write-Host "`n=== $name ===" -ForegroundColor Cyan }

function Check($label, $ok, $detail) {
    if ($ok) { $script:pass++; Write-Host "  PASS  $label" -ForegroundColor DarkGreen }
    else { $script:failures += "$label -- $detail"; Write-Host "  FAIL  $label -- $detail" -ForegroundColor Red }
}

function Skip($label, $why) {
    $script:skips += "$label -- $why"
    Write-Host "  SKIP  $label -- $why" -ForegroundColor DarkYellow
}

function Call($method, $path, $token, $body) {
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    $call = @{ Method = $method; Uri = "$api$path"; Headers = $headers; ContentType = 'application/json' }
    if ($null -ne $body) { $call['Body'] = ($body | ConvertTo-Json -Depth 8 -Compress) }
    try {
        $r = Invoke-WebRequest @call -UseBasicParsing
        $data = $null
        if ($r.Content) { try { $data = $r.Content | ConvertFrom-Json } catch { $data = $r.Content } }
        return @{ status = [int]$r.StatusCode; ok = $true; data = $data }
    }
    catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return @{ status = $code; ok = $false; error = $_.ErrorDetails.Message }
    }
}

function Raw($method, $url, $token) {
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    try {
        $r = Invoke-WebRequest -Method $method -Uri $url -Headers $headers -UseBasicParsing
        return @{ status = [int]$r.StatusCode; ok = $true }
    }
    catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return @{ status = $code; ok = $false }
    }
}

function Login($email, $password) {
    $r = Call POST '/auth/login' $null @{ email = $email; password = $password }
    if ($r.ok) { return $r.data }
    return $null
}

# ── Resolve one account per role ────────────────────────────────────────────

Section 'Role sign-in'

$DEMO_PW = 'Demo@12345'
$roles = @{}

$rafi = Login 'rafi@turfchai.dev' 'demo1234'
Check 'player A signs in' ($null -ne $rafi) 'rafi@turfchai.dev login failed'
if ($rafi) { $roles['playerA'] = $rafi }

# Find a second player, two owners and a host from the demo dataset by probing
# the deterministic seeded email pattern.
$firstNames = @('Fahim', 'Nadia', 'Tariq', 'Meem', 'Rahim', 'Sadia', 'Arman', 'Tania', 'Imran', 'Riya',
    'Karim', 'Fatema', 'Jakir', 'Layla', 'Rasel', 'Sumaiya', 'Shamim', 'Nusrat', 'Naim', 'Mitu',
    'Riyad', 'Sabina', 'Farhan', 'Ayesha', 'Sagor', 'Jannatul', 'Mizan', 'Tasnim', 'Rubel', 'Noor',
    'Abdur', 'Rifat', 'Masum', 'Shirin', 'Pavel', 'Brishty', 'Shakil', 'Parveen', 'Shohag', 'Meher',
    'Habib', 'Sunita', 'Zahid', 'Liza', 'Tomal', 'Ruma', 'Babu', 'Tamanna', 'Robin', 'Moni')
$lastNames = @('Rahman', 'Hossain', 'Islam', 'Amin', 'Chowdhury', 'Ahmed', 'Khan', 'Sultana', 'Begum', 'Malik',
    'Sarkar', 'Molla', 'Hasan', 'Uddin', 'Mia', 'Bhuiyan', 'Dey', 'Roy', 'Paul', 'Biswas')

function SeededEmail($index) {
    $f = $firstNames[$index % $firstNames.Count].ToLower()
    $l = $lastNames[[math]::Floor($index / $firstNames.Count) % $lastNames.Count].ToLower()
    return "$f.$l.$index@gmail.com"
}

$found = @{ PLAYER = @(); OWNER = @(); HOST = @() }
for ($i = 0; $i -lt 260; $i++) {
    if ($found.PLAYER.Count -ge 1 -and $found.OWNER.Count -ge 6 -and $found.HOST.Count -ge 1) { break }
    $auth = Login (SeededEmail $i) $DEMO_PW
    if (-not $auth) { continue }
    $r = $auth.user.role
    if ($r -eq 'OWNER') { $found.OWNER += , $auth }
    elseif ($found.ContainsKey($r) -and $found[$r].Count -lt 1) { $found[$r] += , $auth }
}

if ($found.PLAYER.Count -ge 1) { $roles['playerB'] = $found.PLAYER[0] }
if ($found.HOST.Count -ge 1) { $roles['host'] = $found.HOST[0] }

# Prefer owners that actually have bookings, so the cross-owner money checks
# below cannot silently skip.
$withBookings = @()
$withoutBookings = @()
foreach ($o in $found.OWNER) {
    $b = Call GET '/owner/bookings' $o.token $null
    if ($b.status -eq 200 -and $b.data -and @($b.data).Count -gt 0) { $withBookings += , $o } else { $withoutBookings += , $o }
}
$ordered = @($withBookings) + @($withoutBookings)
if ($ordered.Count -ge 1) { $roles['ownerA'] = $ordered[0] }
if ($ordered.Count -ge 2) { $roles['ownerB'] = $ordered[1] }

Check 'player B signs in' ($roles.ContainsKey('playerB')) 'no second PLAYER found in demo data'
Check 'owner A signs in' ($roles.ContainsKey('ownerA')) 'no OWNER found in demo data'
Check 'owner B signs in' ($roles.ContainsKey('ownerB')) 'no second OWNER found in demo data'
Check 'tournament host signs in' ($roles.ContainsKey('host')) 'no HOST found in demo data'

# Admin + super admin go through the 2FA flow.
function AdminLogin($email, $password) {
    # Reuse the gate's shared session when there is one; see run-qa.ps1.
    if ($env:QA_ADMIN_TOKEN) { return @{ token = $env:QA_ADMIN_TOKEN } }
    $ch = Call POST '/admin/auth/login' $null @{ email = $email; password = $password }
    if (-not $ch.ok) { return $null }
    $code = $ch.data.devCode
    if (-not $code) { return $null }
    $v = Call POST '/admin/auth/login/verify' $null @{ challenge = $ch.data.challenge; code = $code }
    if ($v.ok) { return $v.data }
    return $null
}

$admin = $null
# The challenge endpoint is throttled to 5 attempts per 15 minutes per account,
# so back-to-back gate runs exhaust a single admin. Rotate before giving up,
# otherwise a rate limit is misreported as a broken admin console.
foreach ($n in 0..3) {
    $admin = AdminLogin "admin$n@turfchai.com" $DEMO_PW
    if ($admin) { break }
}
Check 'admin signs in through 2FA' ($null -ne $admin) 'admin0..3 all failed 2FA (all four may be rate-limited; retry in 15 min)'
if ($admin) { $roles['admin'] = $admin }

$superAdmin = AdminLogin 'fazle.rabbi.mugdho@gmail.com' $DEMO_PW
if (-not $superAdmin) { $superAdmin = AdminLogin 'superadmin@turfchai.com' $DEMO_PW }
Check 'super admin signs in through 2FA' ($null -ne $superAdmin) 'super admin 2FA failed'
if ($superAdmin) { $roles['superAdmin'] = $superAdmin }

foreach ($k in @('playerA', 'playerB', 'ownerA', 'ownerB', 'host', 'admin', 'superAdmin')) {
    if ($roles.ContainsKey($k)) {
        Write-Host ("        {0,-11} {1,-34} {2}" -f $k, $roles[$k].user.email, $roles[$k].user.role) -ForegroundColor DarkGray
    }
}

function T($role) { if ($roles.ContainsKey($role)) { return $roles[$role].token } return $null }
function UID($role) { if ($roles.ContainsKey($role)) { return $roles[$role].user.id } return $null }

# ── Anonymous ───────────────────────────────────────────────────────────────

Section 'Anonymous visitor'

$publicGets = @(
    '/venues?page=0&size=5',
    '/venues/explore?area=Dhanmondi',
    '/venues/kick-off-arena',
    '/venues/kick-off-arena/reviews',
    '/solo/open-games',
    '/rewards/products'
)
foreach ($p in $publicGets) {
    $r = Call GET $p $null $null
    Check "public GET $p" ($r.status -eq 200) "status $($r.status)"
}

# Private data must never be readable without a token.
$protected = @(
    @{ m = 'GET'; p = '/me' },
    @{ m = 'GET'; p = '/players/me' },
    @{ m = 'GET'; p = '/players/me/stats' },
    @{ m = 'GET'; p = '/bookings' },
    @{ m = 'GET'; p = '/bookings/1' },
    @{ m = 'GET'; p = '/rewards/my-points' },
    @{ m = 'GET'; p = '/rewards/wallet' },
    @{ m = 'GET'; p = '/rewards/activity' },
    @{ m = 'GET'; p = '/notifications' },
    @{ m = 'GET'; p = '/owner/venues' },
    @{ m = 'GET'; p = '/owner/bookings' },
    @{ m = 'GET'; p = '/owner/payments' },
    @{ m = 'GET'; p = '/admin/admins' },
    @{ m = 'GET'; p = '/admin/users' },
    @{ m = 'GET'; p = '/admin/turf-requests' },
    @{ m = 'GET'; p = '/admin/analytics/dashboard' },
    @{ m = 'GET'; p = '/admin/audit-log' },
    @{ m = 'GET'; p = '/admin/payouts' },
    @{ m = 'GET'; p = '/host/tournaments/TR-CUP-0091' },
    @{ m = 'GET'; p = '/tournaments' },
    @{ m = 'GET'; p = '/tournaments/me' },
    @{ m = 'POST'; p = '/bookings/hold-slot'; b = @{ slotId = 1 } },
    @{ m = 'POST'; p = '/payments/checkout'; b = @{ slotId = 1; method = 'BKASH' } },
    @{ m = 'POST'; p = '/payments/cancel/1' },
    @{ m = 'GET'; p = '/payments/refund-preview/1' },
    @{ m = 'POST'; p = '/rewards/redeem'; b = @{ rewardId = 1 } },
    @{ m = 'GET'; p = '/v3/api-docs' }
)
foreach ($e in $protected) {
    $r = Call $e.m $e.p $null $e.b
    Check "anonymous refused $($e.m) $($e.p)" ($r.status -eq 401 -or $r.status -eq 403) "status $($r.status)"
}

# ── Player workflows ────────────────────────────────────────────────────────

Section 'Player: registration and login'

$newEmail = "qa.player.$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())@turfchai.test"
$newPhone = "+8801" + (Get-Random -Minimum 100000000 -Maximum 999999999)
$reg = Call POST '/auth/register' $null @{ fullName = 'QA Player'; email = $newEmail; password = 'Password@123'; phone = $newPhone; role = 'PLAYER' }
Check 'a visitor can register' ($reg.status -eq 201) "status $($reg.status) $($reg.error)"

$dupe = Call POST '/auth/register' $null @{ fullName = 'QA Player'; email = $newEmail; password = 'Password@123'; phone = $newPhone; role = 'PLAYER' }
Check 'duplicate registration is refused' ($dupe.status -eq 409) "status $($dupe.status)"

$selfAdmin = Call POST '/auth/register' $null @{ fullName = 'QA Escalate'; email = "qa.escalate.$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())@turfchai.test"; password = 'Password@123'; phone = "+8801$(Get-Random -Minimum 100000000 -Maximum 999999999)"; role = 'SUPER_ADMIN' }
Check 'self-registering as SUPER_ADMIN is refused' ($selfAdmin.status -ge 400) "status $($selfAdmin.status)"

$badPw = Call POST '/auth/login' $null @{ email = $newEmail; password = 'WrongPassword@1' }
Check 'wrong password is refused' ($badPw.status -eq 401) "status $($badPw.status)"

$badToken = Call GET '/me' 'not-a-real-token' $null
Check 'a forged token is refused' ($badToken.status -eq 401) "status $($badToken.status)"

Section 'Player: profile, explore, search, filters'

$me = Call GET '/players/me' (T 'playerA') $null
Check 'player reads own profile' ($me.status -eq 200) "status $($me.status)"

$stats = Call GET '/players/me/stats' (T 'playerA') $null
Check 'player reads own stats' ($stats.status -eq 200) "status $($stats.status)"

$search = Call GET '/venues?q=arena&page=0&size=10' (T 'playerA') $null
Check 'venue search returns results' ($search.status -eq 200 -and $search.data.items.Count -gt 0) "status $($search.status)"

$filtered = Call GET '/venues?area=Dhanmondi&page=0&size=10' (T 'playerA') $null
$areaOk = $filtered.status -eq 200 -and (($filtered.data.items | Where-Object { $_.area -ne 'Dhanmondi' }).Count -eq 0)
Check 'area filter only returns that area' $areaOk "status $($filtered.status)"

$saved = Call POST '/players/me/saved-venues/kick-off-arena' (T 'playerA') $null
Check 'player saves a venue' ($saved.status -lt 400) "status $($saved.status) $($saved.error)"
$savedList = Call GET '/players/me/saved-venues' (T 'playerA') $null
$isSaved = $savedList.status -eq 200 -and (@($savedList.data | Where-Object { $_.slug -eq 'kick-off-arena' }).Count -gt 0)
Check 'saved venue appears in the list' $isSaved "status $($savedList.status)"
$unsaved = Call DELETE '/players/me/saved-venues/kick-off-arena' (T 'playerA') $null
Check 'player can unsave a venue' ($unsaved.status -lt 400) "status $($unsaved.status)"

Section 'Player: rewards, notifications, open games, tournaments'

foreach ($p in @('/rewards/my-points', '/rewards/wallet', '/rewards/activity', '/notifications', '/solo/open-games', '/bookings')) {
    $r = Call GET $p (T 'playerA') $null
    Check "player GET $p" ($r.status -eq 200) "status $($r.status)"
}

$tour = Call GET '/tournaments' (T 'playerA') $null
Check 'player can browse tournaments' ($tour.status -eq 200) "status $($tour.status)"
$myTours = Call GET '/tournaments/me' (T 'playerA') $null
Check 'player can list own tournament registrations' ($myTours.status -eq 200) "status $($myTours.status)"
$tourDetail = Call GET '/tournaments/TR-CUP-0091' (T 'playerA') $null
Check 'player can view a tournament' ($tourDetail.status -eq 200) "status $($tourDetail.status)"

# ── Booking + money lifecycle for player A ──────────────────────────────────

Section 'Player: booking, payment, cancellation, refund'

$date = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')
$slot = $null; $venueId = $null
foreach ($v in (Call GET '/venues?page=0&size=50' (T 'playerA') $null).data.items) {
    $s = Call GET "/venues/$($v.id)/slots?date=$date" (T 'playerA') $null
    if ($s.ok -and $s.data) {
        $cand = $s.data | Where-Object { $_.status -eq 'AVAILABLE' -and $_.bookable } | Select-Object -First 1
        if ($cand) { $slot = $cand; $venueId = $v.id; break }
    }
}
Check 'a bookable slot exists' ($null -ne $slot) "no AVAILABLE slot on $date"

if ($slot) {
    $hold = Call POST '/bookings/hold-slot' (T 'playerA') @{ slotId = $slot.id }
    Check 'player holds a slot' ($hold.status -eq 200) "status $($hold.status) $($hold.error)"

    $stealHold = Call POST '/bookings/hold-slot' (T 'playerB') @{ slotId = $slot.id }
    Check 'another player cannot steal an active hold' ($stealHold.status -ge 400) "status $($stealHold.status)"

    $stealPay = Call POST '/payments/checkout' (T 'playerB') @{ slotId = $slot.id; method = 'BKASH' }
    Check 'another player cannot pay for a held slot' ($stealPay.status -ge 400) "status $($stealPay.status)"

    $pay = Call POST '/payments/checkout' (T 'playerA') @{ slotId = $slot.id; method = 'BKASH' }
    Check 'player pays for the held slot' ($pay.status -eq 200) "status $($pay.status) $($pay.error)"

    if ($pay.ok) {
        $bookingId = $pay.data.data.bookingId
        $booking = Call GET "/bookings/$bookingId" (T 'playerA') $null
        Check 'booking is CONFIRMED after payment' ($booking.data.status -eq 'CONFIRMED') "status $($booking.data.status)"

        $payments = Call GET "/payments/booking/$bookingId" (T 'playerA') $null
        if ($payments.status -eq 200) {
            $total = ($payments.data.data | Where-Object { $_.type -eq 'BOOKING' } | Measure-Object -Property amount -Sum).Sum
            Check 'payment ledger equals the booking price' ($total -eq [decimal]$booking.data.netAmount) "ledger $total vs booking $($booking.data.netAmount)"
        }
        else {
            Skip 'payment ledger equals the booking price' "GET /payments/booking/{id} returned $($payments.status)"
        }

        $double = Call POST '/payments/checkout' (T 'playerA') @{ slotId = $slot.id; method = 'BKASH' }
        Check 'the same slot cannot be paid for twice' ($double.status -ge 400) "status $($double.status)"

        $peek = Call GET "/bookings/$bookingId" (T 'playerB') $null
        Check 'another player cannot read this booking' ($peek.status -ge 400) "status $($peek.status)"

        $hijack = Call POST "/payments/cancel/$bookingId" (T 'playerB') $null
        Check 'another player cannot cancel this booking' ($hijack.status -ge 400) "status $($hijack.status)"

        $stillConfirmed = Call GET "/bookings/$bookingId" (T 'playerA') $null
        Check 'the booking survived the hijack attempt' ($stillConfirmed.data.status -eq 'CONFIRMED') "status $($stillConfirmed.data.status)"

        $preview = Call GET "/payments/refund-preview/$bookingId" (T 'playerA') $null
        Check 'player can preview the refund' ($preview.status -eq 200) "status $($preview.status)"

        $refund = Call POST "/payments/cancel/$bookingId" (T 'playerA') $null
        Check 'player cancels and is refunded' ($refund.status -eq 200) "status $($refund.status) $($refund.error)"
        if ($refund.ok -and $preview.ok) {
            Check 'refund matches the preview' ([decimal]$refund.data.data.refundAmount -eq [decimal]$preview.data.data.refundAmount) `
                "preview $($preview.data.data.refundAmount) vs refund $($refund.data.data.refundAmount)"
        }

        $cancelled = Call GET "/bookings/$bookingId" (T 'playerA') $null
        Check 'booking is CANCELLED' ($cancelled.data.status -eq 'CANCELLED') "status $($cancelled.data.status)"

        $again = Call POST "/payments/cancel/$bookingId" (T 'playerA') $null
        Check 'a cancelled booking cannot be refunded again' ($again.status -ge 400) "status $($again.status)"
    }
}

# Past slots must never be bookable, whichever venue they belong to.
$pastDate = (Get-Date).AddDays(-3).ToString('yyyy-MM-dd')
$pastSlot = $null
foreach ($v in (Call GET '/venues?page=0&size=50' (T 'playerA') $null).data.items) {
    $s = Call GET "/venues/$($v.id)/slots?date=$pastDate" (T 'playerA') $null
    if ($s.ok -and $s.data) { $pastSlot = @($s.data)[0]; break }
}
if ($pastSlot) {
    Check 'a slot in the past is not marked bookable' (-not $pastSlot.bookable) "bookable=$($pastSlot.bookable)"
    $r = Call POST '/bookings/hold-slot' (T 'playerA') @{ slotId = $pastSlot.id }
    Check 'a slot in the past cannot be held' ($r.status -ge 400) "status $($r.status)"
    $r = Call POST '/payments/checkout' (T 'playerA') @{ slotId = $pastSlot.id; method = 'BKASH' }
    Check 'a slot in the past cannot be paid for' ($r.status -ge 400) "status $($r.status)"
}
else {
    Skip 'past-slot booking refused' 'no past slots in the dataset'
}

$ghost = Call POST '/bookings/hold-slot' (T 'playerA') @{ slotId = 99999999 }
Check 'an unknown slot id is refused' ($ghost.status -ge 400) "status $($ghost.status)"

# ── Owner workflows + owner isolation ───────────────────────────────────────

Section 'Owner: own data'

foreach ($p in @('/owner/venues', '/owner/bookings', '/owner/payments', '/owner/customers', '/owner/reviews', '/owner/analytics/dashboard')) {
    $r = Call GET $p (T 'ownerA') $null
    Check "owner A GET $p" ($r.status -eq 200) "status $($r.status) $($r.error)"
}

$ownerAVenues = (Call GET '/owner/venues' (T 'ownerA') $null).data
$ownerBVenues = (Call GET '/owner/venues' (T 'ownerB') $null).data
$aIds = @($ownerAVenues | ForEach-Object { $_.id })
$bIds = @($ownerBVenues | ForEach-Object { $_.id })
$overlap = @($aIds | Where-Object { $bIds -contains $_ })
Check 'owner A and owner B see disjoint venue lists' ($overlap.Count -eq 0) "shared venue ids: $($overlap -join ',')"

Section 'Owner isolation: owner A -> owner B'

if ($bIds.Count -gt 0) {
    $target = $bIds[0]
    $r = Call GET "/owner/venues/$target" (T 'ownerA') $null
    Check "owner A cannot read owner B's venue $target" ($r.status -ge 400) "status $($r.status)"

    $r = Call GET "/owner/venues/$target/slots?date=$date" (T 'ownerA') $null
    Check "owner A cannot read owner B's slots" ($r.status -ge 400) "status $($r.status)"

    $r = Call PATCH "/owner/venues/$target" (T 'ownerA') @{ name = 'Hijacked By Owner A' }
    Check "owner A cannot rename owner B's venue" ($r.status -ge 400) "status $($r.status)"
}
else {
    Skip 'owner A -> owner B venue access' 'owner B has no venues'
}

# Owner B's bookings must not be readable, cancellable or refundable by owner A.
$bBookings = @((Call GET '/owner/bookings' (T 'ownerB') $null).data)
if ($bBookings.Count -gt 0) {
    $bBookingId = $bBookings[0].id
    $aBookingIds = @((Call GET '/owner/bookings' (T 'ownerA') $null).data | ForEach-Object { $_.id })
    Check "owner A's booking list excludes owner B's booking" (-not ($aBookingIds -contains $bBookingId)) "booking $bBookingId visible to both"

    $r = Call GET "/bookings/$bBookingId" (T 'ownerA') $null
    Check "owner A cannot read owner B's booking" ($r.status -ge 400) "status $($r.status)"

    $r = Call POST "/owner/bookings/$bBookingId/refund" (T 'ownerA') $null
    Check "owner A cannot refund owner B's booking" ($r.status -ge 400) "status $($r.status)"

    $r = Call POST "/owner/bookings/$bBookingId/cancel" (T 'ownerA') $null
    Check "owner A cannot cancel owner B's booking" ($r.status -ge 400) "status $($r.status)"

    $after = Call GET "/bookings/$bBookingId" (T 'ownerB') $null
    Check "owner B's booking survived owner A's attempts" ($after.data.status -ne 'CANCELLED') "status $($after.data.status)"
}
else {
    Skip "owner A -> owner B booking actions" 'owner B has no bookings'
}

# ── Host workflows + host ownership ─────────────────────────────────────────

Section 'Tournament host'

$hostTours = Call GET '/host/tournaments/TR-CUP-0091' (T 'playerA') $null
Check 'the demo tournament host can open it' ($hostTours.status -eq 200) "status $($hostTours.status)"

# The demo tournament TR-CUP-0091 is hosted by the demo player, not by our host.
$notMine = Call GET '/host/tournaments/TR-CUP-0091' (T 'host') $null
Check "a host cannot read another host's tournament" ($notMine.status -ge 400) "status $($notMine.status)"

$notMineWrite = Call PATCH '/host/tournaments/TR-CUP-0091/settings' (T 'host') @{ hostNotes = 'hijacked' }
Check "a host cannot edit another host's tournament" ($notMineWrite.status -ge 400) "status $($notMineWrite.status)"

$notMineTeam = Call POST '/host/tournaments/TR-CUP-0091/teams' (T 'host') @{ name = 'Hijack FC'; captainName = 'Nobody' }
Check "a host cannot add a team to another host's tournament" ($notMineTeam.status -ge 400) "status $($notMineTeam.status)"

$notMineInvite = Call POST '/host/tournaments/TR-CUP-0091/invite-code' (T 'host') $null
Check "a host cannot rotate another host's invite code" ($notMineInvite.status -ge 400) "status $($notMineInvite.status)"

$notMineFixtures = Call POST '/host/tournaments/TR-CUP-0091/fixtures/generate' (T 'host') $null
Check "a host cannot regenerate another host's fixtures" ($notMineFixtures.status -ge 400) "status $($notMineFixtures.status)"

# ── Admin + super admin ─────────────────────────────────────────────────────

Section 'Admin console'

$adminGets = @(
    '/admin/users?page=0&size=10',
    '/admin/turf-requests',
    '/admin/venues?page=0&size=10',
    '/admin/analytics/dashboard',
    '/admin/analytics/growth',
    '/admin/analytics/segments',
    '/admin/analytics/revenue',
    '/admin/audit-log',
    '/admin/admins',
    '/admin/payouts'
)
foreach ($p in $adminGets) {
    $r = Call GET $p (T 'admin') $null
    Check "admin GET $p" ($r.status -eq 200) "status $($r.status) $($r.error)"
}

$docs = Raw GET 'http://localhost:8080/v3/api-docs' (T 'admin')
Check 'admin can read the API docs' ($docs.status -eq 200) "status $($docs.status)"# ── Cross-role attack matrix ────────────────────────────────────────────────

Section 'Cross-role attacks'

$attacks = @(
    @{ from = 'playerA'; label = 'player -> owner'; m = 'GET'; p = '/owner/venues' },
    @{ from = 'playerA'; label = 'player -> owner'; m = 'GET'; p = '/owner/bookings' },
    @{ from = 'playerA'; label = 'player -> owner'; m = 'GET'; p = '/owner/payments' },
    @{ from = 'playerA'; label = 'player -> owner'; m = 'GET'; p = '/owner/customers' },
    @{ from = 'playerA'; label = 'player -> owner'; m = 'GET'; p = '/owner/analytics/dashboard' },
    @{ from = 'playerA'; label = 'player -> admin'; m = 'GET'; p = '/admin/users' },
    @{ from = 'playerA'; label = 'player -> admin'; m = 'GET'; p = '/admin/admins' },
    @{ from = 'playerA'; label = 'player -> admin'; m = 'GET'; p = '/admin/analytics/dashboard' },
    @{ from = 'playerA'; label = 'player -> admin'; m = 'GET'; p = '/admin/analytics/revenue' },
    @{ from = 'playerA'; label = 'player -> admin'; m = 'GET'; p = '/admin/audit-log' },
    @{ from = 'playerA'; label = 'player -> admin'; m = 'GET'; p = '/admin/payouts' },
    @{ from = 'playerA'; label = 'player -> admin'; m = 'GET'; p = '/admin/turf-requests' },
    @{ from = 'ownerA'; label = 'owner -> admin'; m = 'GET'; p = '/admin/users' },
    @{ from = 'ownerA'; label = 'owner -> admin'; m = 'GET'; p = '/admin/admins' },
    @{ from = 'ownerA'; label = 'owner -> admin'; m = 'GET'; p = '/admin/payouts' },
    @{ from = 'ownerA'; label = 'owner -> admin'; m = 'GET'; p = '/admin/analytics/revenue' },
    @{ from = 'ownerA'; label = 'owner -> admin'; m = 'GET'; p = '/admin/audit-log' },
    @{ from = 'host'; label = 'host -> owner'; m = 'GET'; p = '/owner/venues' },
    @{ from = 'host'; label = 'host -> owner'; m = 'GET'; p = '/owner/payments' },
    @{ from = 'host'; label = 'host -> admin'; m = 'GET'; p = '/admin/users' },
    @{ from = 'playerB'; label = 'player -> host area'; m = 'GET'; p = '/host/tournaments/TR-CUP-0091' }
)
foreach ($a in $attacks) {
    $tok = T $a.from
    if (-not $tok) { Skip "$($a.label) $($a.m) $($a.p)" "no token for $($a.from)"; continue }
    $r = Call $a.m $a.p $tok $null
    Check "$($a.label): $($a.m) $($a.p) refused" ($r.status -eq 401 -or $r.status -eq 403) "status $($r.status)"
}

# Player A must not be able to read player B's private data.
$pbId = UID 'playerB'
if ($pbId) {
    $r = Call GET "/players/$pbId" (T 'playerA') $null
    Check "player A cannot read player B's profile by id" ($r.status -ge 400) "status $($r.status)"
}

# The API reference is a map of every route and schema, so it is staff-only.
foreach ($who in @('playerA', 'ownerA', 'host')) {
    $r = Raw GET 'http://localhost:8080/v3/api-docs' (T $who)
    Check "$who cannot read the API docs" ($r.status -eq 401 -or $r.status -eq 403) "status $($r.status)"
}
$anonDocs = Raw GET 'http://localhost:8080/v3/api-docs' $null
Check 'anonymous cannot read the API docs' ($anonDocs.status -eq 401 -or $anonDocs.status -eq 403) "status $($anonDocs.status)"
$anonSwagger = Raw GET 'http://localhost:8080/swagger-ui/index.html' $null
Check 'anonymous cannot open Swagger UI' ($anonSwagger.status -eq 401 -or $anonSwagger.status -eq 403) "status $($anonSwagger.status)"

# ── Summary ─────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host ("PASSED: {0}   FAILED: {1}   SKIPPED: {2}" -f $script:pass, $script:failures.Count, $script:skips.Count)
if ($script:failures.Count -gt 0) {
    Write-Host "`nFAILURES:" -ForegroundColor Red
    $script:failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
if ($script:skips.Count -gt 0) {
    Write-Host "`nSKIPPED:" -ForegroundColor DarkYellow
    $script:skips | ForEach-Object { Write-Host "  - $_" -ForegroundColor DarkYellow }
}
if ($script:failures.Count -gt 0) { exit 1 } else { exit 0 }
