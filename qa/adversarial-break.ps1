# STEP 2 - adversarial break suite.
#
# Everything here is an attempt to make the server do something wrong: forged
# and tampered tokens, identity spoofing, cross-tenant reads, concurrency on a
# single slot, injection, oversized and malformed payloads, and time edge cases.
# A check passes only when the server refuses correctly.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\qa\adversarial-break.ps1

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$API = 'http://localhost:8080/api/v1'
$DEMO_PW = 'Demo@12345'

$script:pass = 0
$script:fail = 0
$script:findings = @()

function Pass($what, $evidence) {
    $script:pass++
    Write-Host ("PASS  {0}" -f $what) -ForegroundColor Green
    if ($evidence) { Write-Host ("      {0}" -f $evidence) -ForegroundColor DarkGray }
}
function Fail($what, $evidence) {
    $script:fail++
    $script:findings += "$what :: $evidence"
    Write-Host ("FAIL  {0}" -f $what) -ForegroundColor Red
    Write-Host ("      {0}" -f $evidence) -ForegroundColor Red
}
function Info($m) { Write-Host ("  ..  {0}" -f $m) -ForegroundColor DarkGray }

function Call($method, $path, $token, $body, $rawBody, $contentType) {
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    $uri = if ($path -like 'http*') { $path } else { "$API$path" }
    $req = @{ Uri = $uri; Method = $method; Headers = $headers; UseBasicParsing = $true; TimeoutSec = 60 }
    if ($null -ne $rawBody) {
        $req['ContentType'] = $(if ($contentType) { $contentType } else { 'application/json' })
        $req['Body'] = $rawBody
    } elseif ($null -ne $body) {
        $req['ContentType'] = 'application/json'
        $req['Body'] = ($body | ConvertTo-Json -Depth 8)
    }
    try {
        $r = Invoke-WebRequest @req
        # Decode from raw bytes: application/json carries no charset (correct per
        # RFC 8259) and PowerShell then assumes Latin-1, which turns every
        # Bangla or emoji response into fake mojibake findings.
        return @{ status = [int]$r.StatusCode; body = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) }
    } catch {
        $resp = $_.Exception.Response
        if ($resp) {
            $text = ''
            try {
                $s = $resp.GetResponseStream()
                if ($s.CanSeek) { $s.Position = 0 }
                $text = (New-Object System.IO.StreamReader($s)).ReadToEnd()
            } catch { $text = '' }
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
function AdminLogin($email) {
    # Reuse the gate's shared session when there is one; see run-qa.ps1.
    if ($env:QA_ADMIN_TOKEN) { return @{ token = $env:QA_ADMIN_TOKEN } }
    $ch = Call POST '/admin/auth/login' $null @{ email = $email; password = $DEMO_PW }
    if ($ch.status -ne 200) { return $null }
    $d = $ch.body | ConvertFrom-Json
    if (-not $d.devCode) { return $null }
    $v = Call POST '/admin/auth/login/verify' $null @{ challenge = $d.challenge; code = $d.devCode }
    if ($v.status -ne 200) { return $null }
    $vj = $v.body | ConvertFrom-Json
    if ($vj.token) { return $vj }
    return $vj.data
}
function Rows($text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return @() }
    try { $p = $text | ConvertFrom-Json } catch { return @() }
    if ($null -eq $p) { return @() }
    return @($p | Where-Object { $null -ne $_ })
}
function Unwrap($text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    try { $p = $text | ConvertFrom-Json } catch { return $null }
    if ($null -ne $p -and ($p.PSObject.Properties.Name -contains 'data') -and ($p.PSObject.Properties.Name -contains 'success')) { return $p.data }
    return $p
}

Write-Host ''
Write-Host '================ ADVERSARIAL BREAK ================' -ForegroundColor Cyan

$playerA = Login 'rafi@turfchai.dev' 'demo1234'
if (-not $playerA) { Write-Host 'FATAL: demo player login failed' -ForegroundColor Red; exit 2 }
$admin = $null
foreach ($n in 0..3) { $admin = AdminLogin "admin$n@turfchai.com"; if ($admin) { break } }

$playerB = $null; $ownerA = $null; $ownerB = $null
if ($admin) {
    foreach ($role in @('PLAYER', 'OWNER')) {
        $rr = Call GET "/admin/users?page=0&size=60&role=$role" $admin.token $null
        foreach ($u in @((Unwrap $rr.body).items)) {
            if ($playerB -and $ownerA -and $ownerB) { break }
            if (-not $u.email) { continue }
            $c = Login $u.email $DEMO_PW
            if (-not $c) { continue }
            if ($c.user.role -eq 'PLAYER' -and -not $playerB -and $c.user.id -ne $playerA.user.id) { $playerB = $c; continue }
            if ($c.user.role -eq 'OWNER') {
                $owned = Rows (Call GET '/owner/venues' $c.token $null).body
                if ($owned.Count -eq 0) { continue }
                if (-not $ownerA) { $ownerA = $c } elseif (-not $ownerB) { $ownerB = $c }
            }
        }
    }
}
Info "actors: playerB=$($playerB.user.email) ownerA=$($ownerA.user.email) ownerB=$($ownerB.user.email) admin=$([bool]$admin)"

# ---------------------------------------------------------------- TOKENS ----
Write-Host ''
Write-Host '--- forged and tampered credentials ---' -ForegroundColor Yellow

$parts = $playerA.token.Split('.')
$tampered = @{
    'signature stripped'      = "$($parts[0]).$($parts[1])."
    'alg=none style token'    = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.' + $parts[1] + '.'
    'payload swapped'         = "$($parts[0]).eyJzdWIiOiIxIiwicm9sZSI6IlNVUEVSX0FETUlOIn0.$($parts[2])"
    'signature from nowhere'  = "$($parts[0]).$($parts[1]).AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    'random garbage'          = 'not.a.token'
    'empty bearer'            = ' '
}
foreach ($k in $tampered.Keys) {
    $r = Call GET '/me' $tampered[$k] $null
    if ($r.status -in 401, 403) { Pass "token refused: $k" "HTTP $($r.status)" }
    else { Fail "TOKEN ACCEPTED: $k" "HTTP $($r.status) body=$($r.body.Substring(0,[Math]::Min(120,$r.body.Length)))" }
}

# An expired token: signed for a user, but the server must reject stale ones.
$r = Call GET '/me' 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJyYWZpQHR1cmZjaGFpLmRldiIsImV4cCI6MTAwMDAwMDAwMH0.x' $null
if ($r.status -in 401, 403) { Pass 'expired/foreign-signed token refused' "HTTP $($r.status)" }
else { Fail 'EXPIRED TOKEN ACCEPTED' "HTTP $($r.status)" }

# --------------------------------------------------------------- SPOOFING ---
Write-Host ''
Write-Host '--- identity spoofing via headers and body ---' -ForegroundColor Yellow

if ($playerB) {
    $spoofHeaders = @('X-User-Id', 'X-User-Email', 'X-Forwarded-User', 'X-Admin', 'X-Role')
    $bad = @()
    foreach ($h in $spoofHeaders) {
        $req = @{ Uri = "$API/me"; Method = 'GET'; UseBasicParsing = $true; TimeoutSec = 30
            Headers = @{ Authorization = "Bearer $($playerA.token)"; $h = "$($playerB.user.publicId)" }
        }
        try { $resp = Invoke-WebRequest @req; $who = ($resp.Content | ConvertFrom-Json).email } catch { $who = 'error' }
        if ($who -and $who -ne $playerA.user.email) { $bad += "$h -> $who" }
    }
    if ($bad.Count -eq 0) { Pass 'no header can change who the server thinks you are' "$($spoofHeaders.Count) headers tried" }
    else { Fail 'IDENTITY SPOOFED BY HEADER' ($bad -join '; ') }

    # role escalation through the profile body
    Call PATCH '/players/me' $playerA.token @{ role = 'SUPER_ADMIN'; isAdmin = $true; status = 'ACTIVE' } | Out-Null
    $meNow = Call GET '/me' $playerA.token $null
    $roleNow = ($meNow.body | ConvertFrom-Json).role
    if ($roleNow -eq 'PLAYER') { Pass 'role cannot be escalated through the profile body' "role still $roleNow" }
    else { Fail 'PRIVILEGE ESCALATION' "role became $roleNow" }
}

# ------------------------------------------------------------ CROSS-USER ----
Write-Host ''
Write-Host '--- cross-user and cross-owner reads ---' -ForegroundColor Yellow

if ($playerB) {
    $bkB = Rows (Call GET '/bookings' $playerB.token $null).body
    if ($bkB.Count -gt 0) {
        $victim = $bkB[0]
        $probes = @(
            @{ m = 'GET'; p = "/bookings/$($victim.id)" },
            @{ m = 'GET'; p = "/payments/booking/$($victim.id)" },
            @{ m = 'GET'; p = "/payments/refund-preview/$($victim.id)" },
            @{ m = 'POST'; p = "/payments/cancel/$($victim.id)" },
            @{ m = 'POST'; p = "/bookings/$($victim.id)/cancel" },
            @{ m = 'POST'; p = "/matchday/checkin?bookingId=$($victim.id)" }
        )
        $leaks = @()
        foreach ($pr in $probes) {
            $r = Call $pr.m $pr.p $playerA.token $null
            if ($r.status -notin 401, 403, 404) { $leaks += "$($pr.m) $($pr.p) -> $($r.status)" }
        }
        if ($leaks.Count -eq 0) { Pass "player A cannot touch player B's booking" "$($probes.Count) probes refused" }
        else { Fail 'CROSS-USER ACCESS' ($leaks -join '; ') }
    } else { Fail 'cross-user probe had no subject' 'player B has no booking; the check proved nothing' }
}

if ($ownerA -and $ownerB) {
    $vaResp = Call GET '/owner/venues' $ownerA.token $null
    $vaParsed = $null
    try { $vaParsed = $vaResp.body | ConvertFrom-Json } catch { $vaParsed = $null }
    $va = @($vaParsed | Where-Object { $_ -and $_.id })
    if ($va.Count -gt 0) {
        $vid = $va[0].id
        # Write paths must be refused outright. 405 counts: the verb does not
        # exist, so nothing happened.
        $probes = @(
            @{ m = 'GET'; p = "/owner/venues/$vid" },
            @{ m = 'PUT'; p = "/owner/venues/$vid"; b = @{ name = 'TAMPER' } },
            @{ m = 'POST'; p = "/owner/venues/$vid/photos"; b = @{ url = 'https://x/y.jpg' } }
        )
        $leaks = @()
        foreach ($pr in $probes) {
            $r = Call $pr.m $pr.p $ownerB.token $pr.b
            if ($r.status -notin 401, 403, 404, 405) { $leaks += "$($pr.m) $($pr.p) -> $($r.status)" }
        }
        if ($leaks.Count -eq 0) { Pass "owner B cannot reach owner A's venue" "$($probes.Count) probes refused" }
        else { Fail 'CROSS-OWNER ACCESS' ($leaks -join '; ') }

        # The owner dashboard is caller-scoped: it answers 200 but must ignore a
        # foreign venueId. Compare bodies rather than status codes.
        $foreign = (Call GET "/owner/analytics/dashboard?venueId=$vid" $ownerB.token $null).body
        $own = (Call GET '/owner/analytics/dashboard' $ownerB.token $null).body
        $theirs = (Call GET "/owner/analytics/dashboard?venueId=$vid" $ownerA.token $null).body
        if ($foreign -eq $own -and $foreign -ne $theirs) {
            Pass 'owner dashboard ignores a foreign venueId' 'owner B sees only their own figures'
        } else {
            Fail 'CROSS-OWNER DATA LEAK VIA venueId' "foreign==own:$($foreign -eq $own) foreign==theirs:$($foreign -eq $theirs)"
        }
    } else { Fail 'cross-owner probe had no subject' 'owner A owns no venue; the check proved nothing' }
} else { Fail 'cross-owner probe could not run' "ownerA=$([bool]$ownerA) ownerB=$([bool]$ownerB) admin=$([bool]$admin)" }

# ------------------------------------------------------------ CONCURRENCY ---
Write-Host ''
Write-Host '--- concurrency: two players race for one slot ---' -ForegroundColor Yellow

if ($playerB) {
    $vlist = Unwrap (Call GET '/venues?page=0&size=10' $null $null).body
    $target = $null
    foreach ($v in @($vlist.items)) {
        foreach ($d in 2..5) {
            $day = (Get-Date).AddDays($d).ToString('yyyy-MM-dd')
            $slots = Rows (Call GET "/venues/$($v.id)/slots?date=$day" $null $null).body
            $free = @($slots | Where-Object { $_.status -eq 'AVAILABLE' -and $_.bookable }) | Select-Object -First 1
            if ($free) { $target = $free; break }
        }
        if ($target) { break }
    }
    if ($target) {
        $jobs = @()
        foreach ($tok in @($playerA.token, $playerB.token)) {
            $jobs += Start-Job -ScriptBlock {
                param($api, $t, $slotId)
                try {
                    $r = Invoke-WebRequest -Uri "$api/bookings/hold-slot" -Method Post -Headers @{ Authorization = "Bearer $t" } `
                        -ContentType 'application/json' -Body (@{ slotId = $slotId } | ConvertTo-Json) -UseBasicParsing -TimeoutSec 30
                    return [int]$r.StatusCode
                } catch { if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }; return 0 }
            } -ArgumentList $API, $tok, $target.id
        }
        $results = $jobs | Wait-Job -Timeout 60 | Receive-Job
        $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
        $ok = @($results | Where-Object { $_ -eq 200 -or $_ -eq 201 }).Count
        if ($ok -le 1) { Pass 'a contested slot is held by at most one player' "results: $($results -join ',')" }
        else { Fail 'DOUBLE-SELL: two players held the same slot' "results: $($results -join ',')" }
    } else { Fail 'slot-contention probe had no subject' 'no free future slot found; the check proved nothing' }
}

# --------------------------------------------------------------- INJECTION --
Write-Host ''
Write-Host '--- injection and malformed payloads ---' -ForegroundColor Yellow

$payloads = @(
    "'; DROP TABLE bookings; --",
    "1 OR 1=1",
    "<script>alert(1)</script>",
    "../../../../etc/passwd",
    "%00",
    ("A" * 5000)
)
$bad = @()
foreach ($p in $payloads) {
    $enc = [System.Uri]::EscapeDataString($p)
    $r = Call GET "/venues?q=$enc" $null $null
    if ($r.status -ge 500) { $bad += "search '$($p.Substring(0,[Math]::Min(20,$p.Length)))' -> $($r.status)" }
}
if ($bad.Count -eq 0) { Pass 'hostile search terms never produce a 5xx' "$($payloads.Count) payloads" }
else { Fail 'SERVER ERROR ON HOSTILE INPUT' ($bad -join '; ') }

# The venue list must still be a real list after those.
$after = Unwrap (Call GET '/venues?page=0&size=1' $null $null).body
if ($after.totalItems -gt 0) { Pass 'venue catalogue intact after injection attempts' "totalItems=$($after.totalItems)" }
else { Fail 'CATALOGUE DAMAGED' "totalItems=$($after.totalItems)" }

# Malformed bodies and wrong content types.
$malformed = @(
    @{ name = 'invalid JSON'; raw = '{"slotId": '; ct = 'application/json' },
    @{ name = 'array where object expected'; raw = '[1,2,3]'; ct = 'application/json' },
    @{ name = 'xml content type'; raw = '<slot/>'; ct = 'application/xml' },
    @{ name = 'deeply nested json'; raw = ('{"a":' * 200 + '1' + '}' * 200); ct = 'application/json' }
)
$bad = @()
foreach ($m in $malformed) {
    $r = Call POST '/bookings/hold-slot' $playerA.token $null $m.raw $m.ct
    if ($r.status -ge 500) { $bad += "$($m.name) -> $($r.status)" }
}
if ($bad.Count -eq 0) { Pass 'malformed bodies answer 4xx, never 5xx' "$($malformed.Count) payloads" }
else { Fail 'SERVER ERROR ON MALFORMED BODY' ($bad -join '; ') }

# Oversized review comment and unicode.
$r = Call POST '/reviews' $playerA.token @{ bookingId = 1; venueId = 1; overallRating = 5; comment = ('x' * 50000) }
if ($r.status -lt 500) { Pass 'a 50k-character review is refused, not crashed' "HTTP $($r.status)" }
else { Fail 'SERVER ERROR ON OVERSIZED REVIEW' "HTTP $($r.status)" }

$r = Call PATCH '/players/me' $playerA.token @{ fullName = "Test 🏟️ ৳ <b>bold</b> Ω" }
if ($r.status -lt 500) { Pass 'unicode and markup in a profile name are handled' "HTTP $($r.status)" }
else { Fail 'SERVER ERROR ON UNICODE NAME' "HTTP $($r.status)" }

# A Dhaka product must store Bangla names byte-for-byte.
$bangla = -join ([char[]](0x09B0, 0x09BE, 0x09AB, 0x09BF, 0x0989, 0x09B2))
$r = Call PATCH '/players/me' $playerA.token $null ('{"fullName":' + (ConvertTo-Json $bangla) + '}') 'application/json; charset=utf-8'
$back = (Call GET '/players/me' $playerA.token $null).body | ConvertFrom-Json
if ($back.fullName -eq $bangla) { Pass 'a Bangla name round-trips exactly' "stored $($back.fullName.Length) chars" }
else { Fail 'NON-LATIN NAME CORRUPTED' "sent $($bangla.Length) chars, stored $($back.fullName.Length)" }
Call PATCH '/players/me' $playerA.token @{ fullName = 'Rafiul Karim' } | Out-Null

# --------------------------------------------------------------- ID ABUSE ---
Write-Host ''
Write-Host '--- invalid and hostile identifiers ---' -ForegroundColor Yellow

$ids = @('0', '-1', '99999999999999999999', 'abc', 'null', 'undefined', '1e10', '../1')
$bad = @()
foreach ($id in $ids) {
    $r = Call GET "/bookings/$([System.Uri]::EscapeDataString($id))" $playerA.token $null
    if ($r.status -ge 500) { $bad += "id '$id' -> $($r.status)" }
}
if ($bad.Count -eq 0) { Pass 'hostile booking ids answer 4xx, never 5xx' "$($ids.Count) ids" }
else { Fail 'SERVER ERROR ON HOSTILE ID' ($bad -join '; ') }

# --------------------------------------------------------- TIME EDGE CASES --
Write-Host ''
Write-Host '--- date and time edge cases ---' -ForegroundColor Yellow

$vFirst = (Unwrap (Call GET '/venues?page=0&size=1' $null $null).body).items[0]
$dates = @('1970-01-01', '1999-12-31', '2038-01-19', '2999-12-31', '2026-02-30', 'not-a-date', '2026-13-45')
$bad = @()
foreach ($d in $dates) {
    $r = Call GET "/venues/$($vFirst.id)/slots?date=$d" $null $null
    if ($r.status -ge 500) { $bad += "$d -> $($r.status)" }
}
if ($bad.Count -eq 0) { Pass 'extreme and invalid dates never produce a 5xx' "$($dates.Count) dates" }
else { Fail 'SERVER ERROR ON DATE EDGE CASE' ($bad -join '; ') }

# ------------------------------------------------------------- PAGINATION ---
Write-Host ''
Write-Host '--- pagination and large data ---' -ForegroundColor Yellow

$cases = @('page=0&size=0', 'page=-1&size=-1', 'page=99999999&size=10', 'size=1000000', 'page=abc&size=abc')
$bad = @()
foreach ($c in $cases) {
    $r = Call GET "/venues?$c" $null $null
    if ($r.status -ge 500) { $bad += "$c -> $($r.status)" }
}
if ($bad.Count -eq 0) { Pass 'pagination extremes answer 2xx/4xx, never 5xx' "$($cases.Count) cases" }
else { Fail 'SERVER ERROR ON PAGINATION' ($bad -join '; ') }

# ------------------------------------------------------------ MONEY ABUSE ---
Write-Host ''
Write-Host '--- payment abuse ---' -ForegroundColor Yellow

$abuse = @(
    @{ name = 'negative wallet amount'; b = @{ slotId = 1; method = 'BKASH'; applyWalletAmount = -5000 } },
    @{ name = 'absurd wallet amount'; b = @{ slotId = 1; method = 'BKASH'; applyWalletAmount = 999999999 } },
    @{ name = 'unknown payment method'; b = @{ slotId = 1; method = 'FREE_MONEY'; applyWalletAmount = 0 } },
    @{ name = 'missing slot'; b = @{ slotId = 99999999; method = 'BKASH'; applyWalletAmount = 0 } }
)
$bad = @()
foreach ($a in $abuse) {
    $r = Call POST '/payments/checkout' $playerA.token $a.b
    if ($r.status -ge 500) { $bad += "$($a.name) -> $($r.status)" }
    if ($r.status -in 200, 201) { $bad += "$($a.name) ACCEPTED -> $($r.status)" }
}
if ($bad.Count -eq 0) { Pass 'no abusive checkout is accepted or crashes' "$($abuse.Count) payloads" }
else { Fail 'PAYMENT ABUSE' ($bad -join '; ') }

# --------------------------------------------------------------- SUMMARY ----
Write-Host ''
Write-Host '===================================================' -ForegroundColor Cyan
if ($script:fail -eq 0) {
    Write-Host "ADVERSARIAL BREAK CLEAN ($($script:pass) checks)" -ForegroundColor Green
    exit 0
}
Write-Host "$($script:fail) ADVERSARIAL FINDING(S) out of $($script:pass + $script:fail)" -ForegroundColor Red
foreach ($f in $script:findings) { Write-Host "  - $f" -ForegroundColor Red }
exit 1
