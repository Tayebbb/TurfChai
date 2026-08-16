# Stages and commits the QA remediation work in coherent, reviewable groups.
$ErrorActionPreference = 'Stop'
Set-Location -Path 'e:\TurfChai'

function Commit($paths, $subject, $bodyLines) {
    foreach ($p in $paths) {
        if (Test-Path $p) { git add -- $p | Out-Null }
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

# 1 ---------------------------------------------------------------- security
Commit @(
    '.gitignore',
    'src/main/java/com/turfchai/config/SecurityConfig.java',
    'src/main/java/com/turfchai/security/',
    'src/main/java/com/turfchai/exception/UnauthenticatedException.java',
    'src/main/java/com/turfchai/service/impl/AuthServiceImpl.java',
    'src/main/java/com/turfchai/service/impl/InMemoryOtpService.java',
    'src/main/java/com/turfchai/player/config/PlayerDataSeeder.java',
    'src/test/java/com/turfchai/security/',
    'src/test/java/com/turfchai/testsupport/',
    'frontend/src/guards/'
) 'security: deny by default and take identity only from the token' @(
    'SecurityConfig now denies any request that is not explicitly permitted, and',
    'the three ways a caller could previously assert an identity are gone: the',
    'X-User-Id header, the demo-user fallbacks used when the principal was null,',
    'and allow-by-default routing. AuthenticatedUser is the only path from a',
    'principal to an id and throws UnauthenticatedException (401) when there is',
    'none.',
    '',
    'The OTP endpoint returned the generated code in its response body to any',
    'caller, which was account takeover for any phone number. It is now gated on',
    'app.otp.expose-dev-code and throttled per phone, with the code burned after',
    'five wrong guesses.',
    '',
    'On the frontend only /admin had a guard, so owner, host and private player',
    'routes rendered for anonymous visitors. RequireAuth checks the role the',
    'server reports for the stored token, not the one the browser cached.'
)

# 2 ------------------------------------------------- API contract + DTO edges
Commit @(
    'src/main/java/com/turfchai/exception/',
    'src/main/java/com/turfchai/dto/response/',
    'src/main/java/com/turfchai/booking/dto/response/OwnerBookingResponse.java',
    'src/main/java/com/turfchai/ai/api/AiExceptionHandler.java',
    'src/main/java/com/turfchai/player/api/PlayerApiExceptionHandler.java',
    'src/main/java/com/turfchai/venue/api/VenueApiExceptionHandler.java',
    'src/main/java/com/turfchai/tournament/api/TournamentApiExceptionHandler.java',
    'src/main/java/com/turfchai/controller/AdminAnalyticsRestController.java',
    'src/main/java/com/turfchai/controller/AdminAuditLogRestController.java',
    'src/main/java/com/turfchai/controller/AdminPayoutRestController.java',
    'src/main/java/com/turfchai/controller/AdminTurfRequestRestController.java',
    'src/main/java/com/turfchai/controller/AdminUserRestController.java',
    'src/main/java/com/turfchai/controller/AdminVenueRestController.java',
    'src/main/java/com/turfchai/controller/NotificationRestController.java',
    'src/main/java/com/turfchai/controller/OwnerTurfRequestRestController.java',
    'src/test/java/com/turfchai/api/'
) 'api: one error envelope and explicit DTOs on every read' @(
    'Every advice, the global handler and the security filter chain now answer',
    'with ApiErrorBody. Filter-chain 401s and 403s used to have empty bodies, and',
    'a malformed request body outside a scoped advice returned 500.',
    '',
    'Admin and notification reads return purpose-built DTOs instead of entities.',
    'Serialising the entity graph both leaked personal data and produced',
    'LazyInitializationException 500s under open-in-view=false, which unit tests',
    'cannot catch -- only a real HTTP round trip can, so ApiContractRegressionTest',
    'hits every admin listing.'
)

# 3 --------------------------------------------------- booking + payment core
Commit @(
    'src/main/java/com/turfchai/booking/',
    'src/main/java/com/turfchai/payment/',
    'src/main/java/com/turfchai/reward/',
    'src/main/resources/db/migration/',
    'src/test/java/com/turfchai/booking/',
    'src/test/java/com/turfchai/payment/'
) 'booking: make the money and the state machine tell the truth' @(
    'Refunds were computed from the gross booking amount and paid entirely as',
    'cash, so a booking part-paid with wallet credit refunded money the gateway',
    'never took and destroyed the credit as well. Refunds are now split by tender.',
    'A booking with no successful payment refunds nothing.',
    '',
    'Other corrections in the same area: points are reversed on cancellation',
    'instead of being kept; a wallet-covered booking writes its own payment row so',
    'a confirmed booking always reconciles; refund tiers use an injected Clock',
    'rather than the JVM zone; a second cancellation is refused instead of',
    'releasing a slot another booking had taken; and finalizeConfirmedBooking',
    're-checks the hold under the slot lock.',
    '',
    'SlotTimePolicy is the single authority on whether a slot may still be sold.',
    'OwnerPaymentService no longer inserts bookings from a read-only GET.'
)

# 4 ------------------------------------------------------- fabricated figures
Commit @(
    'src/main/java/com/turfchai/service/',
    'src/main/java/com/turfchai/controller/OwnerCustomerRestController.java',
    'src/main/java/com/turfchai/controller/OwnerReviewRestController.java',
    'src/main/java/com/turfchai/controller/ReviewRestController.java',
    'src/main/java/com/turfchai/controller/VenueReviewRestController.java',
    'src/main/java/com/turfchai/domain/Review.java',
    'src/main/java/com/turfchai/dto/ReviewDto.java',
    'src/main/java/com/turfchai/dto/analytics/GrowthDto.java',
    'src/main/java/com/turfchai/venue/',
    'src/main/java/com/turfchai/repository/',
    'src/main/java/com/turfchai/player/',
    'src/test/java/com/turfchai/integrity/',
    'src/test/java/com/turfchai/venue/',
    'src/test/java/com/turfchai/service/',
    'src/test/java/com/turfchai/player/'
) 'analytics: report measured figures, never invented ones' @(
    'Occupancy was the literal "100%" on every venue on every day, retention was a',
    'hardcoded 84.2, owner refunds were a hardcoded zero, and the weekly',
    'performance card was four literals. Each is now derived from the rows behind',
    'it, and reports an em dash when there is nothing to measure.',
    '',
    '"Today" on the owner dashboard meant sold today as well as played today, so a',
    'fixture sold now for next week entered today revenue and would be counted',
    'again on the day it was played. The owner payments window had no upper bound',
    'and swept in everything already sold for future dates. Both are now closed at',
    'both ends.',
    '',
    'Customers were credited with visits that had not happened: last visit was the',
    'maximum booking date across all bookings including cancelled and future ones.',
    'A visit is now a confirmed booking whose kick-off has passed.',
    '',
    'Venue ratings were seeded as literals over an empty reviews tab. The seeder',
    'writes real reviews and the aggregates are derived from them. A GET on the',
    'owner venue list no longer creates a venue.'
)

# 5 --------------------------------- tournaments, promotions, pricing, games
Commit @(
    'src/main/java/com/turfchai/tournament/',
    'src/main/java/com/turfchai/promotion/',
    'src/main/java/com/turfchai/pricing/',
    'src/main/java/com/turfchai/media/',
    'src/main/java/com/turfchai/ai/',
    'src/main/java/com/turfchai/dto/request/CreateOpenGameRequest.java',
    'src/test/java/com/turfchai/tournament/',
    'src/test/java/com/turfchai/promotion/',
    'src/test/java/com/turfchai/pricing/'
) 'tournament: one entry per player, and host routes that check the host' @(
    'Registration guarded duplicate team names but never checked whether the',
    'player already had an entry, while withdraw, myTournaments and the tournament',
    'card all resolve a player to a single team. A second registration therefore',
    'produced a state the player could not leave: withdrawal removed the earliest',
    'entry, and once that one was paid it refused outright with the other still',
    'registered.',
    '',
    'Knowing a tournament code is no longer authority over it, and hosts can list',
    'their own tournaments instead of the pages falling back to a hardcoded demo',
    'code that returned 403 to every other host.',
    '',
    'Promotion updates are a validated request rather than an untyped map, and',
    'CreateOpenGameRequest no longer requires an organizer id the controller',
    'ignores.'
)

Write-Host ''
git log --oneline -6
Write-Host ''
Write-Host ("remaining unstaged/untracked: " + @(git status --porcelain).Count)
