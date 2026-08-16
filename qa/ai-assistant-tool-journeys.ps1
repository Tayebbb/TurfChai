$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8080'
$run = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

function Chat($message, $token, $tag) {
    $json = @{ sessionId = "probe-$tag-$run"; message = $message } | ConvertTo-Json
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    $r = Invoke-WebRequest -Uri "$base/api/ai/chat" -Method POST -Body $bytes -ContentType 'application/json' -Headers $headers -UseBasicParsing
    return ([System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json)
}

function Api($path, $token) {
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    $r = Invoke-WebRequest -Uri "$base$path" -Headers $headers -UseBasicParsing
    return ([System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json)
}

function Report($name, $result, $expectedTool, $mustContain) {
    $tools = @($result.toolsUsed)
    $calledIt = $tools -contains $expectedTool
    Write-Host ""
    Write-Host "### $name"
    Write-Host "tools : $($tools -join ', ')"
    Write-Host "reply : $($result.reply)"
    if (-not $calledIt) {
        Write-Host "FAIL  - expected the model to call $expectedTool"
        return $false
    }
    # A tool call that returned an error still counts as "called", so the reply
    # has to carry a value that only the database could have supplied.
    # Money is rendered as "৳ 2,000", so compare digits only.
    $flatReply = ([string]$result.reply) -replace '[,\s]', ''
    foreach ($needle in $mustContain) {
        $flatNeedle = ([string]$needle) -replace '[,\s]', ''
        if (-not $flatReply.Contains($flatNeedle)) {
            Write-Host "FAIL  - reply omitted the real value '$needle'"
            return $false
        }
    }
    if ($mustContain.Count -eq 0) {
        Write-Host "WARN  - $expectedTool called, but nothing database-specific was asserted"
    }
    Write-Host "PASS  - $expectedTool called and the reply matches the database"
    return $true
}

$pass = @()

# ---- sign in as the seeded demo player -------------------------------------
$loginJson = @{ email = 'rafi@turfchai.dev'; password = 'demo1234' } | ConvertTo-Json
$loginBytes = [System.Text.Encoding]::UTF8.GetBytes($loginJson)
$login = (Invoke-WebRequest -Uri "$base/api/v1/auth/login" -Method POST -Body $loginBytes -ContentType 'application/json' -UseBasicParsing).Content | ConvertFrom-Json
$token = $login.token
Write-Host "signed in as $($login.user.fullName)"

# ---- 1. check_availability -------------------------------------------------
$venue = (Api '/api/v1/venues?page=0&size=1&sort=rating' $null).items[0]
$date = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')
$slots = Api "/api/v1/venues/$($venue.id)/slots?date=$date" $null
$free = @($slots | Where-Object { $_.bookable })
Write-Host ""
Write-Host "DB truth: $($venue.name) has $($free.Count) bookable slots on $date"
$firstPrice = if ($free.Count -gt 0) { [int]$free[0].price } else { 0 }

$r1 = Chat "Which slots are free at $($venue.slug) on $date and what do they cost?" $null 'avail'
$pass += Report 'check_availability (public)' $r1 'manage_booking' @("$firstPrice")

# ---- 2. search_tournaments -------------------------------------------------
$tours = Api '/api/v1/tournaments?openOnly=false&upcomingOnly=false&page=0&size=5' $token
Write-Host ""
Write-Host "DB truth: $($tours.totalItems) tournaments; first = $($tours.items[0].name) ($($tours.items[0].code))"

$r2 = Chat 'What tournaments can I register for? Show the entry fee.' $token 'tourn'
$pass += Report 'search_tournaments' $r2 'search_tournaments' @()

# ---- 3. manage_booking list ------------------------------------------------
$bookings = Api '/api/v1/bookings' $token
Write-Host ""
Write-Host "DB truth: rafi has $($bookings.Count) bookings"

$r3 = Chat 'Show me my bookings.' $token 'list'
$expectCode = if ($bookings.Count -gt 0) { @($bookings[0].bookingCode) } else { @() }
$pass += Report 'manage_booking list (signed in)' $r3 'manage_booking' $expectCode

# ---- 4. get_payment_status -------------------------------------------------
if ($bookings.Count -gt 0) {
    $code = $bookings[0].bookingCode
    Write-Host ""
    Write-Host "DB truth: booking $code amount=$($bookings[0].amount) status=$($bookings[0].status)"
    $r4 = Chat "What is the payment status of booking $code" $token 'pay'
    $pass += Report 'get_payment_status' $r4 'get_payment_status' @($code)
}
else {
    Write-Host ''
    Write-Host 'SKIP - rafi has no bookings, so get_payment_status cannot be exercised'
    $pass += $false
}

Write-Host ''
Write-Host "==== $((@($pass | Where-Object { $_ })).Count) of $($pass.Count) tool journeys passed ===="
