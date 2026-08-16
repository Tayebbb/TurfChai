<#
    Consolidates every QA artifact into a single machine-readable baseline:
        qa\baseline\qa-baseline.json
#>
param([string]$Dir = "$PSScriptRoot\baseline")
$ErrorActionPreference = 'Stop'
function Load($n) { $p = Join-Path $Dir $n; if (Test-Path $p) { return (Get-Content $p -Raw | ConvertFrom-Json) } ; return $null }

$dataset  = Load 'qa-dataset.json'
$api      = Load 'qa-findings-api.json'
$followup = Load 'qa-findings-followup.json'
$proofs   = Load 'qa-findings-proofs.json'
$join     = Load 'qa-join-identity-proof.json'
$dead     = Load 'qa-dead-controls.json'

$repo = Resolve-Path "$PSScriptRoot\.."
Push-Location $repo
$commit = (git rev-parse HEAD).Trim()
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$dirty  = @(git status --porcelain | Where-Object { $_ -notmatch '(^|\s)qa/' })
Pop-Location

$baseline = [ordered]@{
    artifact = 'turfchai-qa-reproduction-baseline'
    version  = 1
    generatedAt = (Get-Date).ToString('o')
    phase = 'PRE-FIX BASELINE - no application source modified'

    environment = [ordered]@{
        commit = $commit
        branch = $branch
        appSourceModified = ($dirty.Count -eq 0)
        dirtyNonQaPaths = $dirty
        backend = 'Spring Boot 4.1.0 / Java 25, profile=dev, http://localhost:8080'
        frontend = 'Vite 7 / React 19, http://localhost:5173'
        database = 'in-memory H2 (jdbc:h2:mem:turfchai;MODE=PostgreSQL), ddl-auto=update'
        flywayEnabled = $false
        flywayNote = 'spring.flyway.enabled=false in application-dev.properties; V1-V27 never execute locally'
        backendTests = [ordered]@{ command='mvnw -o test'; total=300; passed=300; failed=0; skipped=0; result='BUILD SUCCESS' }
        frontendLint = [ordered]@{ command='npx eslint .'; errors=0; warnings=0 }
        frontendBuild = [ordered]@{ command='npm run build'; result='success' }
        frontendTests = [ordered]@{ present=$false; note='package.json has no test script, no runner and no test dependency' }
        e2eTests = [ordered]@{ present=$false }
        backendLog = "$env:TEMP\tc-qa-backend.log"
    }

    dataset = $dataset
    findings = [ordered]@{
        api = $api
        followupProbes = $followup
        decisiveProofs = $proofs
        joinIdentityProof = $join
        deadControls = [ordered]@{
            summary = $dead.summary
            scannedFiles = $dead.scannedFiles
            inlineToastOnlyHandlers = $dead.inlineToastOnlyHandlers
            nativeDialogs = $dead.nativeDialogs
            consoleStatements = $dead.consoleStatements
        }
    }

    browserReproductions = @(
        [ordered]@{ id='TC-003'; route='/player/dashboard/bookings'; precondition='playerA has 5 bookings'
                    expected='renders the booking list'; actual='ErrorBoundary: This page did not load'
                    error='TypeError: paths.player.booking is not a function'
                    source='frontend/src/pages/player/dashboard/PendingSections.jsx:41 (stack reports :55 after Vite transform)'
                    control='/player/bookings renders the same data: Upcoming(2) Pending(0) Completed(2) Cancelled(1)'
                    reproduced=$true }
        [ordered]@{ id='TC-004'; route='/admin/turfs/:id'; precondition='SUPER_ADMIN session; 52 venues exist'
                    expected='renders venue detail'; actual='ErrorBoundary for ids 1, 51 and 99999'
                    error="TypeError: Cannot read properties of undefined (reading 'toLocaleString')"
                    source='frontend/src/pages/admin/TurfDetailsPage.jsx:323 venue.bookings30d.toLocaleString()'
                    control='/admin/turfs list renders 52 venues'
                    reproduced=$true }
        [ordered]@{ id='TC-008'; route='/player and /player/dashboard/settings'; precondition='localStorage cleared, no session'
                    expected='no user identity rendered'
                    actual='greeting "Salam, Rafiul", avatar RK, area "Dhanmondi, Dhaka", 100% reliability; settings form pre-filled with rafi@turfchai.dev'
                    rootCause='TC-001: PlayerLayout calls getMyProfile() and /api/v1/players/me is permitAll with a demo-user fallback'
                    reproduced=$true }
        [ordered]@{ id='TC-011-runtime'; route='various'; precondition='clicked with network capture'
                    expected='controls perform their labelled action'
                    actual='7 of 7 clicked controls produced a toast with zero API calls and zero downloads'
                    controls=@(
                        'owner/bookings > + Manual booking','owner/bookings > Next page',
                        'owner/customers > + Add customer','owner/payments > Monthly report',
                        'admin/activity > Export CSV','admin/users > Export roster CSV',
                        'admin/profile > Change Password','OwnerLayout > notification bell (hardcoded "3 new notifications")')
                    reproduced=$true }
    )

    notTestable = @(
        [ordered]@{ item='Flyway V1-V27 migration chain'; reason='disabled in dev; local Postgres credentials incorrect'; needed='PostgreSQL instance + default profile' }
        [ordered]@{ item='Real payment settlement / refunds / payouts'; reason='no gateway integration exists'; needed='bKash/Nagad sandbox credentials' }
        [ordered]@{ item='Cloudinary media upload'; reason='CLOUDINARY_URL unset, service falls back to a stub'; needed='Cloudinary credentials' }
        [ordered]@{ item='AI assistant answer quality'; reason='provider quota exhausted, fallback breaker engaged'; needed='funded OPENROUTER_API_KEY' }
        [ordered]@{ item='Admin OTP delivery'; reason='dev returns devCode inline'; needed='mail/SMS provider' }
        [ordered]@{ item='Cross-browser / real-device responsive'; reason='single Chromium engine'; needed='device farm' }
        [ordered]@{ item='Load / performance'; reason='scripts/load-test.js not executed'; needed='k6 + target environment' }
        [ordered]@{ item='AdminPartBDataSeeder output'; reason='seeder never executes (QA-N01)'; needed='lifecycle fix or API-side seeding' }
    )

    reproductionCommands = @(
        '.\mvnw.cmd -o spring-boot:run "-Dspring-boot.run.profiles=dev"',
        'cd frontend; npm run dev',
        'powershell -NoProfile -ExecutionPolicy Bypass -File qa\seed-qa-dataset.ps1',
        'powershell -NoProfile -ExecutionPolicy Bypass -File qa\reproduce-findings.ps1',
        'powershell -NoProfile -ExecutionPolicy Bypass -File qa\followup-probes.ps1',
        'powershell -NoProfile -ExecutionPolicy Bypass -File qa\decisive-proofs.ps1',
        'powershell -NoProfile -ExecutionPolicy Bypass -File qa\join-identity-proof.ps1',
        'powershell -NoProfile -ExecutionPolicy Bypass -File qa\scan-dead-controls.ps1',
        'powershell -NoProfile -ExecutionPolicy Bypass -File qa\build-baseline.ps1'
    )
}

$outPath = Join-Path $Dir 'qa-baseline.json'
$baseline | ConvertTo-Json -Depth 14 | Set-Content $outPath -Encoding UTF8
Write-Host "Written $outPath" -ForegroundColor Green
Write-Host ("commit={0} appSourceModified={1}" -f $commit, ($dirty.Count -ne 0))
Write-Host ("api findings: total={0} reproduced={1} new={2} notReproduced={3}" -f `
    $api.summary.total, $api.summary.reproduced, $api.summary.newFindings, $api.summary.notReproduced)
Write-Host ("dead controls: inlineToastOnly={0}" -f $dead.summary.inlineToastOnlyHandlers)
Write-Host ("dataset: accounts={0} bookings={1} ownerSlots={2}" -f $dataset.qaAccounts.Count, $dataset.bookings.Count, $dataset.ownerSlots.Count)
