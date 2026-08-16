$ErrorActionPreference = 'Stop'
Set-Location -Path 'e:\TurfChai'

function Commit($paths, $subject, $bodyLines, [switch]$KeepTests) {
    foreach ($p in $paths) {
        if (Test-Path $p) { git add -- $p | Out-Null } else { git add -- $p 2>$null | Out-Null }
    }
    if (-not $KeepTests) {
        git reset -q -- '*.test.js' '*.test.jsx' 2>$null | Out-Null
    }
    $staged = @(git diff --cached --name-only)
    if ($staged.Count -eq 0) {
        Write-Host "SKIP (nothing staged): $subject" -ForegroundColor DarkYellow
        return
    }
    $msgFile = Join-Path $env:TEMP ("tc-commit-" + [guid]::NewGuid().ToString('N') + ".txt")
    $lines = @($subject, '')
    $lines += $bodyLines
    [System.IO.File]::WriteAllLines($msgFile, $lines, (New-Object System.Text.UTF8Encoding $false))
    git commit -q -F $msgFile
    Remove-Item $msgFile -Force
    Write-Host ("OK  [{0} file(s)] {1}" -f $staged.Count, $subject) -ForegroundColor Green
}

# 6 ------------------------------------------------------------ frontend core
Commit @(
    'frontend/src/api/',
    'frontend/src/context/',
    'frontend/src/hooks/',
    'frontend/src/utils/',
    'frontend/src/routes/',
    'frontend/src/components/',
    'frontend/src/constants/',
    'frontend/src/data/',
    'frontend/src/main.jsx'
) 'frontend: one session, one error message, no synthesised identity' @(
    'SessionProvider owns who is signed in. Seven components each fetched the',
    'profile through their own useApi, so a single guarded navigation issued four',
    'identical identity requests; the guards now read context and fetch nothing.',
    '',
    'getMyProfile used to synthesise a profile from localStorage when the request',
    'failed, which fabricated an identity and hid 401s. It is gone, and a rejected',
    'token clears the session instead of bouncing the reader out of whatever page',
    'they were on.',
    '',
    'toUserMessage keeps the raw server text on error.detail for logs and puts a',
    'human sentence on error.message, so 5xx internals can no longer reach a',
    'screen. Several endpoints answer 200 with an empty body, which the client',
    'read as JSON and reported as a failure on an action that had succeeded.',
    '',
    'The mock data modules are deleted. They were the source of most fabricated',
    'figures, and every page that used them now reads the API.'
)

# 7 --------------------------------------------------------- frontend screens
Commit @(
    'frontend/src/pages/',
    'frontend/src/layouts/',
    'frontend/src/host/',
    'frontend/src/solo/',
    'frontend/src/public/',
    'frontend/src/auth/',
    'frontend/src/styles/'
) 'frontend: every control does the real thing or says why it cannot' @(
    'Four handlers announced success after the write had failed, including a',
    'trade licence "uploaded successfully" that existed only as a blob URL and a',
    'photo upload that substituted a stock photograph as the persisted image.',
    'Controls with no backend are now disabled with a title saying so.',
    '',
    'The landing page was fabricated end to end: a four-field search of',
    'non-interactive divs whose button ignored all of them, platform statistics an',
    'order of magnitude above the real ones, and three hardcoded venues under a',
    '"live availability" heading with invented distances. It now reads the',
    'catalogue and its selects navigate.',
    '',
    'Checkout collected a card number, expiry, CVV and wallet PIN into a gateway',
    'that does not exist and threw them away. It is one honest confirmation step',
    'that states TurfChai does not take payment online yet.',
    '',
    'The booking confirmation and detail screens never named the venue or the',
    'pitch, although the booking record carries both and every owner surface shows',
    'them. Back after paying reported the slot as taken by someone else when the',
    'booking was the reader own.'
)

# 8 ---------------------------------------------------------- tests + QA suite
Commit @(
    'frontend/src/test/',
    'frontend/scripts/',
    'frontend/scan-honesty.mjs',
    'frontend/playwright.config.js',
    'frontend/e2e/',
    'frontend/qa/',
    'frontend/vite.config.js',
    'frontend/eslint.config.js',
    'frontend/package.json',
    'frontend/package-lock.json',
    'qa/',
    'TESTING.md',
    'README.md',
    'SECURITY-REMEDIATION.md',
    'FINANCIAL-BOOKING-AUDIT.md',
    'FEATURE-CONNECTIVITY-AUDIT.md',
    'DEAD-CONTROLS-REMEDIATION.md'
) 'test: a gate that proves the product rather than the code' -KeepTests @(
    'One command, qa/run-qa.ps1, runs every layer and fails the build if any of',
    'them does. Beyond the unit and component suites it runs, against a live',
    'stack: the role and cross-role attack matrix, an API contract audit, the',
    'regression matrix that re-runs the original reproduction for every defect',
    'found in the first QA pass, adversarial break testing, a crawl of every route',
    'in AppRoutes under six actors, an accessibility and responsive sweep, the',
    'browser end-to-end specs, four complete user journeys, and a cross-surface',
    'consistency audit.',
    '',
    'The journeys check a whole workflow rather than a screen: at every transition',
    'the UI, the URL, the API response and the database row have to agree. The',
    'consistency audit performs one action and then traces the resulting fact',
    'through every surface that reports it, and fails when two of them disagree.',
    '',
    'scan-honesty.mjs reads every catch in the frontend and fails on any handler',
    'that hides a failure, with fourteen reviewed degradations allowlisted by name',
    'and reason.'
)

Write-Host ''
git log --oneline -9
Write-Host ''
Write-Host ("remaining unstaged/untracked: " + @(git status --porcelain).Count)
git status --porcelain | Select-Object -First 20 | Out-String
