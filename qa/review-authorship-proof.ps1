$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8080'

function Post($path, $body, $token) {
    $h = @{ 'Content-Type' = 'application/json' }
    if ($token) { $h['Authorization'] = "Bearer $token" }
    try {
        $r = Invoke-WebRequest -Uri "$base$path" -Method POST -Headers $h -Body ($body | ConvertTo-Json -Depth 8) -UseBasicParsing -TimeoutSec 20
        return @{ status = $r.StatusCode; body = $r.Content }
    } catch {
        $s = $null
        if ($_.Exception.Response) { $s = [int]$_.Exception.Response.StatusCode }
        return @{ status = $s; body = $_.Exception.Message }
    }
}

function Get-Api($path, $token) {
    $h = @{}
    if ($token) { $h['Authorization'] = "Bearer $token" }
    try {
        $r = Invoke-WebRequest -Uri "$base$path" -Method GET -Headers $h -UseBasicParsing -TimeoutSec 20
        return @{ status = $r.StatusCode; body = $r.Content }
    } catch {
        $s = $null
        if ($_.Exception.Response) { $s = [int]$_.Exception.Response.StatusCode }
        return @{ status = $s; body = $_.Exception.Message }
    }
}

$stamp = [DateTime]::UtcNow.ToString('HHmmssfff')

function New-Player($tag) {
    $email = "authorprobe$tag$stamp@qa.test"
    $res = Post '/api/v1/auth/register' @{
        fullName = "Author Probe $tag"
        email    = $email
        password = 'TestPass@123'
        phone    = "+880$((Get-Random -Minimum 100000000 -Maximum 999999999))"
        role     = 'PLAYER'
    } $null
    $j = $res.body | ConvertFrom-Json
    return @{ token = $j.token; id = $j.user.id; publicId = $j.user.publicId; email = $email }
}

$victim   = New-Player 'V'
$attacker = New-Player 'A'
"victim   id=$($victim.id)"
"attacker id=$($attacker.id)"

# Find a bookable slot for the victim that has already started, so a review is
# eligible (the service now refuses reviews for matches that have not begun).
$today = (Get-Date).ToString('yyyy-MM-dd')
$nowT = (Get-Date).ToString('HH:mm:ss')
$slots = (Get-Api "/api/v1/venues/1/slots?date=$today" $null).body | ConvertFrom-Json
$free = @($slots | Where-Object { $_.status -eq 'available' -and $_.startTime -lt $nowT })
if (-not $free) { throw 'no past-but-available slot today; run later in the day' }
$slot = $free[0]
"slot id=$($slot.id) $($slot.startTime)"

$hold = Post '/api/v1/bookings/hold-slot' @{ slotId = $slot.id } $victim.token
"hold -> $($hold.status)"

$confirm = Post '/api/v1/bookings' @{ slotId = $slot.id } $victim.token
"confirm -> $($confirm.status)"
"confirm body: $($confirm.body)"
$cj = $confirm.body | ConvertFrom-Json
$booking = if ($cj.PSObject.Properties.Name -contains 'data') { $cj.data } else { $cj }
$bookingId = $booking.id
"bookingId=$bookingId status=$($booking.status)"
if (-not $bookingId) { throw 'could not resolve bookingId' }

"`n--- A: attacker reviews the victim's booking (should be denied) ---"
$a = Post '/api/v1/reviews' @{
    bookingId     = $bookingId
    venueId       = 1
    userId        = $victim.id
    overallRating = 1
    comment       = 'FORGED BY ATTACKER'
} $attacker.token
"attacker review -> $($a.status)  $($a.body)"

"`n--- B: victim reviews own booking but forges userId=attacker (author must be victim) ---"
$b = Post '/api/v1/reviews' @{
    bookingId     = $bookingId
    venueId       = 1
    userId        = $attacker.id
    overallRating = 5
    comment       = 'AUTHORSHIP PROBE'
} $victim.token
"victim review -> $($b.status)"
"body: $($b.body)"

"`n--- C: duplicate submit by the victim (must be rejected, proving authorship keyed to victim) ---"
$c = Post '/api/v1/reviews' @{
    bookingId     = $bookingId
    venueId       = 1
    userId        = $attacker.id
    overallRating = 5
    comment       = 'AUTHORSHIP PROBE 2'
} $victim.token
"duplicate -> $($c.status)  $($c.body)"

"`n--- D: attacker submits again after the victim's review (still denied) ---"
$d = Post '/api/v1/reviews' @{
    bookingId     = $bookingId
    venueId       = 1
    userId        = $attacker.id
    overallRating = 1
    comment       = 'FORGED 2'
} $attacker.token
"attacker again -> $($d.status)  $($d.body)"

"`nVERDICT:"
$okA = $a.status -eq 403
$okB = $b.status -eq 200 -and $b.body -notmatch 'passwordHash|twoFactorSecret'
$okD = $d.status -eq 403
"  attacker cannot review foreign booking : $(if ($okA) { 'PASS' } else { "FAIL ($($a.status))" })"
"  body userId ignored, review accepted   : $(if ($okB) { 'PASS' } else { "FAIL ($($b.status))" })"
"  attacker still denied after            : $(if ($okD) { 'PASS' } else { "FAIL ($($d.status))" })"
