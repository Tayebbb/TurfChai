$ErrorActionPreference = 'Stop'
Set-Location -Path 'e:\TurfChai'

function Commit($paths, $subject, $bodyLines) {
    foreach ($p in $paths) { git add -- $p | Out-Null }
    $staged = @(git diff --cached --name-only)
    if ($staged.Count -eq 0) { Write-Host "SKIP: $subject"; return }
    $msgFile = Join-Path $env:TEMP ("tc-commit-" + [guid]::NewGuid().ToString('N') + ".txt")
    $lines = @($subject, '') + $bodyLines
    [System.IO.File]::WriteAllLines($msgFile, $lines, (New-Object System.Text.UTF8Encoding $false))
    git commit -q -F $msgFile
    Remove-Item $msgFile -Force
    Write-Host ("OK  [{0} file(s)] {1}" -f $staged.Count, $subject) -ForegroundColor Green
}

Commit @('src/main/java/com/turfchai/controller/OpenGameRestController.java') `
    'solo: take the organiser and the joiner from the token' @(
    'Both endpoints read the acting user from the request body, so a caller could',
    'create a game as somebody else or join one on their behalf. The identity now',
    'comes from the principal and the body fields are ignored.'
)

Commit @('.') 'test: component specs for the screens that were rewritten' @(
    'Vitest specs for the pages this work changed most: checkout, booking detail,',
    'rewards, venue, review, tournament registration, the player dashboard',
    'sections, the owner console and the admin console, plus the API client and',
    'the session context.',
    '',
    'fetch is mocked to reject by default in the setup file, so a call the test',
    'did not stub fails loudly instead of silently returning undefined. A page',
    'that reads useParams must be mounted with renderRoute; rendering it directly',
    'leaves the id undefined and the test quietly becomes an empty-state test.'
)

Write-Host ''
git log --oneline -11
Write-Host ''
Write-Host ("remaining: " + @(git status --porcelain).Count)
