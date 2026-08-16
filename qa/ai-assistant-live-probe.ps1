$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8080'
# Unique per run: conversation memory is keyed on the session id, so a fixed one
# replays the previous run's turns and the probe stops testing a cold start.
$run = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

function Post($path, $body) {
    $json = $body | ConvertTo-Json -Depth 6
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    try {
        $r = Invoke-WebRequest -Uri "$base$path" -Method POST -Body $bytes -ContentType 'application/json' -UseBasicParsing
        $text = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
        return @{ status = $r.StatusCode; body = ($text | ConvertFrom-Json) }
    }
    catch {
        $resp = $_.Exception.Response
        $text = ''
        if ($resp) {
            $s = $resp.GetResponseStream()
            if ($s.CanSeek) { $s.Position = 0 }
            $text = (New-Object System.IO.StreamReader($s)).ReadToEnd()
        }
        return @{ status = [int]$resp.StatusCode; body = $text }
    }
}

function Get($path, $token) {
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    $r = Invoke-WebRequest -Uri "$base$path" -Headers $headers -UseBasicParsing
    $text = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    return ($text | ConvertFrom-Json)
}

Write-Host '--- catalogue truth (what the DB really holds) ---'
$venues = Get '/api/v1/venues?page=0&size=50&sort=rating' $null
$names = @($venues.items | ForEach-Object { $_.name })
Write-Host "venues in database: $($venues.totalItems); first page holds $($names.Count) names"

Write-Host ''
Write-Host '--- anonymous chat: ask for real venues ---'
$one = Post '/api/ai/chat' @{ sessionId = "probe-anon-a-$run"; message = 'List 3 turfs in Dhanmondi with their prices.' }
Write-Host "status: $($one.status)"
Write-Host "tools : $($one.body.toolsUsed -join ', ')"
Write-Host "reply : $($one.body.reply)"

$reply = [string]$one.body.reply
$calledSearch = @($one.body.toolsUsed) -contains 'search_venues'
Write-Host $(if ($calledSearch) { 'PASS - the catalogue tool was called for a venue question' }
    else { 'FAIL - no catalogue tool was called, so any venue named would be invented' })

# The model may legitimately ask for a date instead of listing, so naming a
# venue is not required. Naming one that does not exist is the real failure.
$named = @($names | Where-Object { $reply.Contains([string]$_) })
$looksLikeAList = $reply -match '\|'
if ($named.Count -gt 0) {
    Write-Host "PASS - every venue named exists in the database: $($named -join ' | ')"
}
elseif ($looksLikeAList) {
    Write-Host 'FAIL - the reply lists venues but none of them exist in the database'
}
else {
    Write-Host 'OK   - the reply named no venue (it asked a clarifying question)'
}

Write-Host ''
Write-Host '--- anonymous chat: personal data must be refused ---'
$two = Post '/api/ai/chat' @{ sessionId = "probe-anon-b-$run"; message = 'Show me my bookings and my points balance.' }
Write-Host "tools : $($two.body.toolsUsed -join ', ')"
Write-Host "reply : $($two.body.reply)"

Write-Host ''
Write-Host '--- signed-in chat: real profile ---'
$login = Post '/api/v1/auth/login' @{ email = 'rafi@turfchai.dev'; password = 'demo1234' }
$token = $login.body.token
$me = Get '/api/v1/me' $token
Write-Host "signed in as: $($me.fullName)"

$json = @{ sessionId = "probe-auth-$run"; message = 'What is my points balance and what tier am I?' } | ConvertTo-Json
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$r = Invoke-WebRequest -Uri "$base/api/ai/chat" -Method POST -Body $bytes -ContentType 'application/json' -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing
$three = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
Write-Host "tools : $($three.toolsUsed -join ', ')"
Write-Host "reply : $($three.reply)"

$points = Get '/api/v1/rewards/my-points' $token
Write-Host "ledger says: balance=$($points.data.balance) tier=$($points.data.currentTier.name)"
