# One-command QA for TurfChai.
#
#   pwsh qa/run-qa.ps1              full suite: backend, frontend, e2e
#   pwsh qa/run-qa.ps1 -Quick       static gates only (no servers needed)
#   pwsh qa/run-qa.ps1 -SkipE2E     everything except the browser suite
#   pwsh qa/run-qa.ps1 -KeepServers leave the servers running afterwards
#
# Starts whatever is not already running, waits for it, runs every layer, then
# tidies up only the processes it started itself.

[CmdletBinding()]
param(
    [switch]$Quick,
    [switch]$SkipE2E,
    [switch]$KeepServers
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root 'frontend'
$apiUrl = 'http://localhost:8080'
$webPort = 4173
$results = [ordered]@{}
$startedByUs = @()

function Step($name, [scriptblock]$body) {
    Write-Host ""
    Write-Host "=== $name ===" -ForegroundColor Cyan
    $ok = & $body
    $results[$name] = [bool]$ok
    if ($ok) {
        Write-Host "--- $name OK" -ForegroundColor Green
    } else {
        Write-Host "--- $name FAILED" -ForegroundColor Red
    }
}

function PortBusy($port) {
    [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function WaitForUrl($url, $label, $attempts = 60) {
    for ($i = 0; $i -lt $attempts; $i++) {
        try {
            Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 | Out-Null
            return $true
        } catch {
            if ($_.Exception.Response) { return $true }  # answering, just not 2xx
            Start-Sleep -Seconds 2
        }
    }
    Write-Host "$label never became ready at $url" -ForegroundColor Red
    return $false
}

# -- Static gates ------------------------------------------------------------

Step 'backend unit + integration tests' {
    Push-Location $root
    try {
        & .\mvnw.cmd -o clean test 2>&1 | Tee-Object -Variable out | Out-Null
        $line = ($out | Select-String -Pattern 'Tests run: \d+, Failures: \d+, Errors: \d+, Skipped: \d+$' | Select-Object -Last 1)
        if ($line) { Write-Host "    $($line.Line.Trim())" }
        return ($out -join "`n") -match 'BUILD SUCCESS'
    } finally { Pop-Location }
}

Step 'frontend lint' {
    Push-Location $frontend
    try { npx eslint . 2>&1 | Out-Null; return $LASTEXITCODE -eq 0 } finally { Pop-Location }
}

# Guards the Phase 13 defect class: a catch that hides a failure from the user,
# especially one followed by a success message that runs regardless.
Step 'frontend honesty (no swallowed failures)' {
    Push-Location $frontend
    try {
        node scan-honesty.mjs 2>&1 | Tee-Object -Variable out | Out-Null
        $line = ($out | Select-String -Pattern '^AGENT D:' | Select-Object -Last 1)
        if ($line) { Write-Host "    $($line.Line.Trim())" }
        return $LASTEXITCODE -eq 0
    } finally { Pop-Location }
}

Step 'frontend component tests' {
    Push-Location $frontend
    try {
        npm test 2>&1 | Tee-Object -Variable out | Out-Null
        # Vitest colours the counts, so match loosely around the ANSI codes.
        $line = ($out | Select-String -Pattern 'Tests\s.*passed' | Select-Object -Last 1)
        if ($line) { Write-Host ('    ' + ($line.Line -replace "$([char]27)\[[0-9;]*m", '').Trim()) }
        return $LASTEXITCODE -eq 0
    } finally { Pop-Location }
}

Step 'frontend build + route check' {
    Push-Location $frontend
    try {
        npm run build 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { return $false }
        npm run check:paths 2>&1 | Out-Null
        return $LASTEXITCODE -eq 0
    } finally { Pop-Location }
}

if ($Quick) {
    Write-Host ""
    Write-Host "Quick mode - skipping the live stack." -ForegroundColor DarkYellow
} else {
    # -- Live stack ----------------------------------------------------------

    Step 'start backend' {
        if (PortBusy 8080) { Write-Host '    already running'; return $true }
        Push-Location $root
        try {
            $log = Join-Path $env:TEMP 'turfchai-qa-backend.log'
            $p = Start-Process -FilePath (Join-Path $root 'mvnw.cmd') `
                -ArgumentList '-o', '-q', '-DskipTests', 'spring-boot:run', '-Dspring-boot.run.profiles=dev' `
                -WorkingDirectory $root -PassThru -WindowStyle Hidden `
                -RedirectStandardOutput $log -RedirectStandardError "$log.err"
            $script:startedByUs += $p
            Write-Host "    starting, log: $log"
        } finally { Pop-Location }
        $probe = $apiUrl + '/api/v1/venues?page=0' + [char]38 + 'size=1'
        return (WaitForUrl $probe 'backend')
    }

    Step 'start web app' {
        $env:E2E_WEB_URL = "http://localhost:$webPort"
        if (PortBusy $webPort) { Write-Host '    already running'; return $true }
        $p = Start-Process -FilePath 'cmd.exe' `
            -ArgumentList '/c', "npm run preview -- --port $webPort" `
            -WorkingDirectory $frontend -PassThru -WindowStyle Hidden
        $script:startedByUs += $p
        $env:E2E_WEB_URL = "http://localhost:$webPort"
        return (WaitForUrl "http://localhost:$webPort" 'web app')
    }

    # Admin sign-in is throttled to 5 challenges per 15 minutes per account.
    # Seven stages each logging in separately exhausts admin0..3 mid-run and the
    # later stages fail with 401 for no product reason. Acquire one session here
    # and let every stage reuse it.
    Step 'admin session (shared across stages)' {
        $env:QA_ADMIN_TOKEN = ''
        foreach ($n in 0..3) {
            try {
                $ch = Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/admin/auth/login' -Method Post `
                    -ContentType 'application/json' `
                    -Body (@{ email = "admin$n@turfchai.com"; password = 'Demo@12345' } | ConvertTo-Json)
                if (-not $ch.devCode) { continue }
                $v = Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/admin/auth/login/verify' -Method Post `
                    -ContentType 'application/json' `
                    -Body (@{ challenge = $ch.challenge; code = $ch.devCode } | ConvertTo-Json)
                $tok = if ($v.token) { $v.token } else { $v.data.token }
                if ($tok) {
                    $env:QA_ADMIN_TOKEN = $tok
                    Write-Host "    reusing admin$n@turfchai.com for every admin-dependent stage"
                    return $true
                }
            } catch { continue }
        }
        Write-Host '    admin0..3 all refused; restart the backend to clear the 2FA throttle'
        return $false
    }

    Step 'live API + role matrix' {
        # The sub-scripts report through Write-Host, so every stream has to be
        # folded into the pipeline before Tee-Object can see the verdict.
        & (Join-Path $PSScriptRoot 'qa-all-roles.ps1') *>&1 | Tee-Object -Variable out | Out-Null
        $line = ($out | Select-String -Pattern 'PASSED: \d+' | Select-Object -Last 1)
        if ($line) { Write-Host "    $($line.Line.Trim())" }
        return (($out -join "`n") -match 'FAILED:\s+0\s')
    }

    Step 'live money lifecycle' {
        & (Join-Path $PSScriptRoot 'verify-money-lifecycle.ps1') *>&1 | Tee-Object -Variable out | Out-Null
        return (($out -join "`n") -match 'ALL CHECKS PASSED')
    }

    Step 'live data integrity' {
        & (Join-Path $PSScriptRoot 'verify-data-integrity.ps1') *>&1 | Tee-Object -Variable out | Out-Null
        return (($out -join "`n") -match 'ALL DATA-INTEGRITY CHECKS PASSED')
    }

    Step 'live API contract audit' {
        & (Join-Path $PSScriptRoot 'api-audit.ps1') *>&1 | Tee-Object -Variable out | Out-Null
        $text = ($out -join "`n")
        $line = ($out | Select-String -Pattern 'passed: \d+' | Select-Object -Last 1)
        if ($line) { Write-Host "    $($line.Line.Trim())" }
        return ($text -match 'failed:\s+0')
    }

    # Re-runs the original reproduction for every finding in the QA baseline and
    # demands the safe behaviour. Nothing here trusts the source code.
    Step 'live TC regression matrix (TC-001..TC-032)' {
        & (Join-Path $PSScriptRoot 'rc-tc-verify.ps1') *>&1 | Tee-Object -Variable out | Out-Null
        $text = ($out -join "`n")
        foreach ($f in ($out | Select-String -Pattern '^FAIL')) { Write-Host "    $($f.Line.Trim())" }
        $line = ($out | Select-String -Pattern 'ALL TC CHECKS PASSED' | Select-Object -Last 1)
        if ($line) { Write-Host "    $($line.Line.Trim())" }
        return ($text -match 'ALL TC CHECKS PASSED')
    }

    # Forged tokens, identity spoofing, cross-tenant reads, slot contention,
    # injection, malformed bodies and time edge cases against the live server.
    Step 'live adversarial break' {
        & (Join-Path $PSScriptRoot 'adversarial-break.ps1') *>&1 | Tee-Object -Variable out | Out-Null
        $text = ($out -join "`n")
        foreach ($f in ($out | Select-String -Pattern '^FAIL')) { Write-Host "    $($f.Line.Trim())" }
        $line = ($out | Select-String -Pattern 'ADVERSARIAL BREAK CLEAN' | Select-Object -Last 1)
        if ($line) { Write-Host "    $($line.Line.Trim())" }
        return ($text -match 'ADVERSARIAL BREAK CLEAN')
    }

    # Adversarial pass: contract vocabulary, cross-user/cross-owner/cross-host
    # attacks, and malformed-input handling, all against the running server.
    Step 'live multi-agent probe' {
        & (Join-Path $PSScriptRoot 'multi-agent-probe.ps1') *>&1 | Tee-Object -Variable out | Out-Null
        $text = ($out -join "`n")
        $failed = ($out | Select-String -Pattern '^FAIL')
        foreach ($f in $failed) { Write-Host "    $($f.Line.Trim())" }
        return ($text -match 'ALL PROBES CLEAN')
    }

    # Every route from AppRoutes.jsx, including dynamic parameters and
    # redirects, under direct navigation, refresh, back/forward, each role, the
    # wrong role, and invalid ids. Per-screen specs only cover the screens
    # someone thought to write a spec for.
    Step 'route crawl (console + network errors)' {
        Push-Location $frontend
        try {
            node qa/ui-crawl.mjs $env:E2E_WEB_URL *>&1 | Tee-Object -Variable out | Out-Null
            $text = ($out -join "`n")
            foreach ($f in ($out | Select-String -Pattern '^(CRASH|BLANK|PAGE ERROR|CONSOLE ERROR|FAILED REQUEST|AUTHORIZATION|NAVIGATION FAILED|ROLE UNAVAILABLE)' | Select-Object -First 12)) {
                Write-Host "    $($f.Line.Trim())"
            }
            $line = ($out | Select-String -Pattern 'UI CRAWL CLEAN' | Select-Object -Last 1)
            if ($line) { Write-Host "    $($line.Line.Trim())" }
            return ($text -match 'UI CRAWL CLEAN')
        } finally { Pop-Location }
    }

    # Complete workflows rather than isolated screens: every transition is
    # checked against the UI, the URL, the API and the database at once, and
    # the state machines are asked to refuse the moves they should refuse.
    $journeys = [ordered]@{
        'journey: player end-to-end' = @{ script = 'qa/journey-player.mjs';        done = 'PLAYER JOURNEY CLEAN' }
        'journey: owner/host/admin'  = @{ script = 'qa/journey-roles.mjs';         done = 'ROLE JOURNEYS CLEAN' }
        'journey: cross-area state'  = @{ script = 'qa/journey-crossarea.mjs';     done = 'CROSS-AREA JOURNEYS CLEAN' }
        'journey: interruptions'     = @{ script = 'qa/journey-interruptions.mjs'; done = 'INTERRUPTION JOURNEYS CLEAN' }
        'cross-surface consistency'  = @{ script = 'qa/consistency-audit.mjs';     done = 'DATA CONSISTENCY CLEAN' }
    }
    foreach ($name in $journeys.Keys) {
        $journey = $journeys[$name]
        Step $name {
            Push-Location $frontend
            try {
                node $journey.script $env:E2E_WEB_URL *>&1 | Tee-Object -Variable out | Out-Null
                $text = ($out -join "`n")
                foreach ($f in ($out | Select-String -Pattern '^FAIL' -Context 0, 1 | Select-Object -First 10)) {
                    Write-Host "    $($f.Line.Trim())"
                }
                $line = ($out | Select-String -Pattern 'JOURNEY|DATA CONSISTENCY' | Select-Object -Last 1)
                if ($line) { Write-Host "    $($line.Line.Trim())" }
                return ($text -match [regex]::Escape($journey.done))
            } finally { Pop-Location }
        }
    }

    Step 'accessibility + responsive' {
        Push-Location $frontend
        try {
            node qa/a11y-audit.mjs $env:E2E_WEB_URL *>&1 | Tee-Object -Variable out | Out-Null
            $text = ($out -join "`n")
            $line = ($out | Select-String -Pattern 'rule\(s\) violated|NO ACCESSIBILITY' | Select-Object -Last 1)
            if ($line) { Write-Host "    $($line.Line.Trim())" }
            return ($text -match 'NO ACCESSIBILITY VIOLATIONS') -and ($text -match 'No horizontal overflow')
        } finally { Pop-Location }
    }

    if (-not $SkipE2E) {
        Step 'browser end-to-end' {
            Push-Location $frontend
            try {
                $env:E2E_WEB_URL = "http://localhost:$webPort"
                npx playwright test 2>&1 | Tee-Object -Variable out | Out-Null
                $line = ($out | Select-String -Pattern '\d+ (passed|failed)' | Select-Object -Last 1)
                if ($line) { Write-Host "    $($line.Line.Trim())" }
                return $LASTEXITCODE -eq 0
            } finally { Pop-Location }
        }
    }
}

# -- Teardown ----------------------------------------------------------------

if (-not $KeepServers -and $startedByUs.Count -gt 0) {
    Write-Host ""
    Write-Host "Stopping the $($startedByUs.Count) server(s) this run started..." -ForegroundColor DarkGray
    foreach ($p in $startedByUs) {
        try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch { }
    }
    # The Maven wrapper spawns the JVM as a child, so free the port explicitly.
    $c = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
    if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }
}

# -- Summary -----------------------------------------------------------------

Write-Host ""
Write-Host "================ QA SUMMARY ================" -ForegroundColor Cyan
foreach ($k in $results.Keys) {
    $mark = if ($results[$k]) { 'PASS' } else { 'FAIL' }
    $colour = if ($results[$k]) { 'Green' } else { 'Red' }
    Write-Host ("  {0,-34} {1}" -f $k, $mark) -ForegroundColor $colour
}
$failed = @($results.Keys | Where-Object { -not $results[$_] })
Write-Host "==========================================="
if ($failed.Count -gt 0) {
    Write-Host "$($failed.Count) stage(s) failed." -ForegroundColor Red
    exit 1
}
Write-Host "All stages passed." -ForegroundColor Green
exit 0
