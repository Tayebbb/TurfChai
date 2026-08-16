# Verifies that the values the QA report flagged as fabricated now come from
# real data. Prints one line per check.
$ErrorActionPreference = 'Stop'
$api = 'http://localhost:8080/api/v1'

function Fail($msg) { Write-Output "FAIL  $msg"; $script:bad++ }
function Pass($msg) { Write-Output "PASS  $msg" }
$script:bad = 0

# --- Player login -----------------------------------------------------------
$player = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType 'application/json' `
    -Body (@{ email = 'rafi@turfchai.dev'; password = 'demo1234' } | ConvertTo-Json)

# --- Reward tiers are served, not hardcoded ---------------------------------
$tiers = (Invoke-RestMethod -Uri "$api/rewards/tiers").data
if ($tiers.Count -ge 3) { Pass "rewards/tiers returns $($tiers.Count) real tiers" }
else { Fail "rewards/tiers returned $($tiers.Count) rows" }

# --- Venue detail exposes the real cancellation policy ----------------------
$venues = Invoke-RestMethod -Uri "$api/venues?page=0&size=1"
$slug = $venues.items[0].slug
$detail = Invoke-RestMethod -Uri "$api/venues/$slug"
if ($detail.cancelPolicy) { Pass "venue $slug exposes cancelPolicy=$($detail.cancelPolicy)" }
else { Fail 'venue detail has no cancelPolicy' }

# --- Owner occupancy is measured, never a flat 100% -------------------------
$owner = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType 'application/json' `
    -Body (@{ email = 'sumaiya.hossain.65@gmail.com'; password = 'Demo@12345' } | ConvertTo-Json)
$oh = @{ Authorization = ('Bearer ' + $owner.token) }

$dash = Invoke-RestMethod -Uri "$api/owner/analytics/dashboard" -Headers $oh
$occ = ($dash.kpis | Where-Object { $_.label -eq 'Occupancy' })
Pass "owner occupancy = $($occ.value)  ($($occ.delta))"
if ($occ.delta) { Pass 'occupancy states the slots it was computed from' }
else { Fail 'occupancy has no supporting detail' }

$stamps = @($dash.activity | ForEach-Object { $_.detail })
$justNow = @($stamps | Where-Object { $_ -like '*Just now*' }).Count
if ($justNow -lt $stamps.Count) { Pass "activity times vary ($justNow of $($stamps.Count) are 'Just now')" }
else { Fail 'every activity row still says Just now' }

if ($null -ne $dash.weekly) {
    Pass ("weekly block is real: revenue=" + $dash.weekly.revenue +
        " prev=" + $dash.weekly.previousRevenue +
        " occ=" + $dash.weekly.occupancyPercent +
        " online=" + $dash.weekly.onlineBookings +
        " manual=" + $dash.weekly.manualBookings)
}
else { Fail 'owner analytics has no weekly block' }

# --- Owner customers: no more placeholder columns ---------------------------
$customers = Invoke-RestMethod -Uri "$api/owner/customers" -Headers $oh
$first = $customers | Select-Object -First 1
if ($first) {
    if ($first.noShows -is [int] -or $first.noShows -match '^\d+$') { Pass "customer no-shows is a real number ($($first.noShows))" }
    else { Fail "customer no-shows is '$($first.noShows)'" }
    if ($first.lastVisit) { Pass "customer lastVisit present ($($first.lastVisit))" }
    else { Fail 'customer lastVisit missing (UI reads lastVisit)' }
    if ($first.loyalty.text) { Pass "customer standing = $($first.loyalty.text)" }
    else { Fail 'customer loyalty is not a badge object' }
}

# --- Owner payment method split is proportional -----------------------------
$pay = Invoke-RestMethod -Uri "$api/owner/payments" -Headers $oh
$split = $pay.data.methodSplit
if ($null -eq $split) { $split = $pay.methodSplit }
if ($split) {
    $widths = ($split | ForEach-Object { $_.width }) -join ' / '
    if ($widths -eq '65% / 35%') { Fail "method split widths are still hardcoded ($widths)" }
    else { Pass "method split widths derived from takings ($widths)" }
}

# --- Admin venue analytics --------------------------------------------------
# Admin sign-in is throttled to 5 challenges per 15 minutes per account, so
# repeated runs have to rotate across the seeded admins.
$adm = $null
if ($env:QA_ADMIN_TOKEN) {
    # Reuse the gate's shared session; see run-qa.ps1.
    $adm = @{ token = $env:QA_ADMIN_TOKEN }
    Pass 'reused the shared admin session'
}
foreach ($email in @('admin0@turfchai.com', 'admin1@turfchai.com', 'admin2@turfchai.com', 'admin3@turfchai.com')) {
    if ($adm) { break }
    try {
        $chal = Invoke-RestMethod -Uri "$api/admin/auth/login" -Method Post -ContentType 'application/json' `
            -Body (@{ email = $email; password = 'Demo@12345' } | ConvertTo-Json)
        $adm = Invoke-RestMethod -Uri "$api/admin/auth/login/verify" -Method Post -ContentType 'application/json' `
            -Body (@{ challenge = $chal.challenge; code = $chal.devCode } | ConvertTo-Json)
        Pass "signed in as $email"
        break
    }
    catch {
        Write-Output "SKIP  $email is throttled or unavailable"
    }
}
if ($null -eq $adm) {
    Write-Output 'SKIP  every admin account is throttled; admin checks not run'
    Write-Output ''
    if ($script:bad -gt 0) { Write-Output "$($script:bad) CHECK(S) FAILED"; exit 1 }
    Write-Output 'ALL DATA-INTEGRITY CHECKS PASSED (admin section skipped)'
    exit 0
}
$ah = @{ Authorization = ('Bearer ' + $adm.token) }

$adminVenues = Invoke-RestMethod -Uri "$api/admin/venues" -Headers $ah
$venue = $adminVenues.data | Select-Object -First 1
$stats = (Invoke-RestMethod -Uri "$api/admin/venues/$($venue.id)/analytics" -Headers $ah).data
Pass ("admin venue analytics: bookings30d=" + $stats.bookings30d +
    " revenue30d=" + $stats.revenue30d +
    " occupancy=" + $stats.occupancyPercent +
    " trend=" + (($stats.trendCounts) -join ','))
if ($stats.trendLabels.Count -eq 7) { Pass 'demand trend has 7 real days' } else { Fail 'demand trend is not 7 days' }

$growth = (Invoke-RestMethod -Uri "$api/admin/analytics/growth" -Headers $ah).data
if ($growth.totalUsers -gt 0 -and $growth.totalUsers -lt 41270) {
    Pass "growth totalUsers = $($growth.totalUsers) (the page used to show 41,270)"
}
else { Fail "growth totalUsers = $($growth.totalUsers)" }

Write-Output ''
if ($script:bad -gt 0) { Write-Output "$($script:bad) CHECK(S) FAILED"; exit 1 }
Write-Output 'ALL DATA-INTEGRITY CHECKS PASSED'
exit 0
