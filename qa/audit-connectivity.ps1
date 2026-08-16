# Live verification for the feature-connectivity audit.
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

Write-Host '=== 1. Payment bypass: POST /api/v1/bookings must refuse players ==='
$playerToken = Login 'rafi@turfchai.dev' 'demo1234'
$code = Status {
    (Invoke-WebRequest -Uri "$base/api/v1/bookings" -Method Post `
        -Headers @{ Authorization = "Bearer $playerToken" } `
        -ContentType 'application/json' -Body '{"slotId":1}' -UseBasicParsing).StatusCode
}
Write-Host "  player -> $code (expect 403; 200 would mean a free booking)"

Write-Host ''
Write-Host '=== 2. OTP: code must not be echoed back on a public endpoint ==='
$otp = Invoke-RestMethod -Uri "$base/api/v1/auth/otp/request" -Method Post `
    -ContentType 'application/json' -Body '{"phone":"+8801700000001"}'
Write-Host "  sent=$($otp.sent) devCode=$(if ($null -eq $otp.devCode) { '<null>' } else { $otp.devCode })"
Write-Host '  (devCode is only present when app.otp.expose-dev-code is on; it is on in this demo profile)'

Write-Host ''
Write-Host '  throttle: a second immediate request for the same number'
$code = Status {
    (Invoke-WebRequest -Uri "$base/api/v1/auth/otp/request" -Method Post `
        -ContentType 'application/json' -Body '{"phone":"+8801700000001"}' -UseBasicParsing).StatusCode
}
Write-Host "  -> $code (expect 4xx)"

Write-Host ''
Write-Host '=== 3. New endpoints answer for a real session ==='
$h = @{ Authorization = "Bearer $playerToken" }

$wallet = Invoke-RestMethod -Uri "$base/api/v1/rewards/wallet" -Headers $h
Write-Host "  GET /rewards/wallet  -> balance=$($wallet.data.balance) entries=$($wallet.data.entries.Count)"

$stats = Invoke-RestMethod -Uri "$base/api/v1/players/me/stats" -Headers $h
Write-Host "  GET /players/me/stats -> bookings=$($stats.totalBookings) venues=$($stats.venuesPlayed) reliability=$($stats.reliabilityScore)"

Write-Host ''
Write-Host '=== 4. Open game creation without organizerUserId ==='
$venues = Invoke-RestMethod -Uri "$base/api/v1/venues?page=0&size=1"
$venueId = ($venues.items | Select-Object -First 1).id
$game = @{
    title = 'Connectivity audit game'; venueId = $venueId
    gameDate = (Get-Date).AddDays(2).ToString('yyyy-MM-dd')
    startTime = '20:00:00'; endTime = '21:30:00'
    skillLevel = 'ALL_LEVELS'; capacity = 10; pricePerPlayer = 250
} | ConvertTo-Json
$created = Invoke-RestMethod -Uri "$base/api/v1/solo/open-games" -Method Post -Headers $h `
    -ContentType 'application/json' -Body $game
Write-Host "  POST /solo/open-games -> id=$($created.id) title=$($created.title) spots=$($created.spotsLeft)"

Write-Host ''
Write-Host '=== 5. Admin payout endpoints ==='
$code = Status { (Invoke-WebRequest -Uri "$base/api/v1/admin/payouts" -UseBasicParsing).StatusCode }
Write-Host "  GET /admin/payouts (anonymous) -> $code (expect 401)"
