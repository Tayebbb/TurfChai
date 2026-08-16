# Phase 8 — live verification of the booking + money lifecycle.
#
# Walks a real player through SEARCH -> SLOT -> HOLD -> CHECKOUT -> PAYMENT ->
# CONFIRMATION -> CANCELLATION -> REFUND against the running backend, and asserts
# that the booking state, the payment ledger and the wallet all agree at each step.
#
# Usage:  pwsh qa/verify-money-lifecycle.ps1

$ErrorActionPreference = 'Stop'
$api = 'http://localhost:8080/api/v1'
$failures = @()

function Check($label, $condition, $detail) {
    if ($condition) {
        Write-Host "  PASS  $label" -ForegroundColor Green
    }
    else {
        Write-Host "  FAIL  $label -- $detail" -ForegroundColor Red
        $script:failures += "$label -- $detail"
    }
}

function Api($method, $path, $token, $body) {
    $headers = @{ 'Content-Type' = 'application/json' }
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    $call = @{ Method = $method; Uri = "$api$path"; Headers = $headers }
    if ($body) { $call['Body'] = ($body | ConvertTo-Json -Depth 6) }
    return Invoke-RestMethod @call
}

function TryApi($method, $path, $token, $body) {
    try { return @{ ok = $true; data = (Api $method $path $token $body) } }
    catch {
        $msg = $_.ErrorDetails.Message
        if (-not $msg) { $msg = $_.Exception.Message }
        return @{ ok = $false; error = $msg }
    }
}

Write-Host "`n== Sign in as the demo player ==" -ForegroundColor Cyan
$login = Api POST '/auth/login' $null @{ email = 'rafi@turfchai.dev'; password = 'demo1234' }
$token = $login.token
Check 'player authenticated' ([bool]$token) 'no access token returned'

Write-Host "`n== Find a bookable slot ==" -ForegroundColor Cyan
$date = (Get-Date).AddDays(2).ToString('yyyy-MM-dd')
$venueId = $null
$slot = $null
foreach ($v in (Api GET '/venues?page=0&size=50' $token $null).items) {
    $found = TryApi GET "/venues/$($v.id)/slots?date=$date" $token $null
    if ($found.ok -and $found.data) {
        $candidate = $found.data | Where-Object { $_.status -eq 'AVAILABLE' } | Select-Object -First 1
        if ($candidate) { $venueId = $v.id; $slot = $candidate; break }
    }
}
Check 'an available future slot exists' ([bool]$slot) "no AVAILABLE slot on $date at any venue"
if (-not $slot) { exit 1 }
Write-Host "  venue $venueId slot $($slot.id) at $($slot.startTime), price $($slot.price)"

Write-Host "`n== Past slots are refused ==" -ForegroundColor Cyan
$pastDate = (Get-Date).AddDays(-2).ToString('yyyy-MM-dd')
$pastFound = TryApi GET "/venues/$venueId/slots?date=$pastDate" $token $null
$pastSlot = if ($pastFound.ok) { $pastFound.data | Select-Object -First 1 } else { $null }
if ($pastSlot) {
    $r = TryApi POST '/bookings/hold-slot' $token @{ slotId = $pastSlot.id }
    Check 'holding a slot in the past is refused' (-not $r.ok) 'the backend allowed it'
}
else {
    Write-Host "  SKIP  no past slots seeded" -ForegroundColor Yellow
}

Write-Host "`n== Hold the slot ==" -ForegroundColor Cyan
$hold = Api POST '/bookings/hold-slot' $token @{ slotId = $slot.id }
Check 'slot is held' ([bool]$hold.heldUntil) "no hold expiry returned"

$dup = TryApi POST '/bookings/hold-slot' $token @{ slotId = $slot.id }
Check 'the holder may extend their own hold' ($dup.ok) 'the holder was locked out of their own hold'

Write-Host "`n== Wallet balance before checkout ==" -ForegroundColor Cyan
$walletBefore = [decimal](Api GET '/rewards/my-points' $token $null).data.walletBalance
if ($walletBefore -le 0) {
    # The split-tender refund is the highest-risk path, so make sure there is
    # wallet credit to spend rather than silently skipping it.
    $redeem = TryApi POST '/rewards/redeem' $token @{ rewardId = 2 }
    if ($redeem.ok) {
        $walletBefore = [decimal](Api GET '/rewards/my-points' $token $null).data.walletBalance
        Write-Host "  redeemed points for wallet credit"
    }
}
Check 'the wallet has credit to spend' ($walletBefore -gt 0) 'could not fund the wallet; split-tender path not covered'
Write-Host "  wallet: $walletBefore"

Write-Host "`n== Pay ==" -ForegroundColor Cyan
$walletToApply = if ($walletBefore -gt 0) { [Math]::Min($walletBefore, 200) } else { 0 }
$payBody = @{ slotId = $slot.id; method = 'BKASH' }
if ($walletToApply -gt 0) { $payBody['applyWalletAmount'] = $walletToApply }
$checkout = (Api POST '/payments/checkout' $token $payBody).data

$bookingId = $checkout.bookingId
Check 'checkout returned a booking' ([bool]$bookingId) 'no bookingId'
Check 'checkout reports success' ($checkout.status -eq 'SUCCESS') "status was $($checkout.status)"
Check 'a payment row exists for the charge' ([bool]$checkout.payment) 'CheckoutResponse.payment was null'
Write-Host "  booking $bookingId, wallet applied $($checkout.walletApplied), charged $($checkout.payment.amount)"

Write-Host "`n== Booking state after payment ==" -ForegroundColor Cyan
$booking = Api GET "/bookings/$bookingId" $token $null
Check 'booking is CONFIRMED' ($booking.status -eq 'CONFIRMED') "status was $($booking.status)"

$gatewayCharged = [decimal]$checkout.payment.amount
$walletCharged = [decimal]$checkout.walletApplied
$total = $gatewayCharged + $walletCharged
Check 'gateway + wallet equals the booking price' ($total -eq [decimal]$booking.netAmount) `
    "charged $total but booking netAmount is $($booking.netAmount)"

$walletAfterPay = [decimal](Api GET '/rewards/my-points' $token $null).data.walletBalance
Check 'wallet was debited by exactly what was applied' `
($walletAfterPay -eq ([decimal]$walletBefore - $walletCharged)) `
    "wallet went $walletBefore -> $walletAfterPay, applied $walletCharged"

Write-Host "`n== Paying again is refused ==" -ForegroundColor Cyan
$again = TryApi POST '/payments/checkout' $token $payBody
Check 'a paid slot cannot be paid for twice' (-not $again.ok) 'the backend charged a second time'

Write-Host "`n== Refund preview ==" -ForegroundColor Cyan
$preview = (Api GET "/payments/refund-preview/$bookingId" $token $null).data
Check 'preview reports what was actually paid' ([decimal]$preview.amountPaid -eq $total) `
    "preview says $($preview.amountPaid), actually paid $total"
Write-Host "  policy $($preview.cancelPolicy), $($preview.refundPercent)% -> $($preview.refundAmount)"

Write-Host "`n== Cancel and refund ==" -ForegroundColor Cyan
$refund = (Api POST "/payments/cancel/$bookingId" $token $null).data
Check 'refund matches the preview' ([decimal]$refund.refundAmount -eq [decimal]$preview.refundAmount) `
    "preview said $($preview.refundAmount), refund paid $($refund.refundAmount)"
Check 'refund never exceeds what was taken' ([decimal]$refund.refundAmount -le $total) `
    "refunded $($refund.refundAmount) against $total taken"

$cancelled = Api GET "/bookings/$bookingId" $token $null
Check 'booking is CANCELLED' ($cancelled.status -eq 'CANCELLED') "status was $($cancelled.status)"

$expectedWalletBack = [Math]::Round($walletCharged * $refund.refundPercent / 100, 2)
$walletAfterRefund = [decimal](Api GET '/rewards/my-points' $token $null).data.walletBalance
Check 'the wallet share came back to the wallet' `
($walletAfterRefund -eq ($walletAfterPay + $expectedWalletBack)) `
    "wallet went $walletAfterPay -> $walletAfterRefund, expected +$expectedWalletBack"

Write-Host "`n== Cancelling twice is refused ==" -ForegroundColor Cyan
$twice = TryApi POST "/payments/cancel/$bookingId" $token $null
Check 'a cancelled booking cannot be refunded again' (-not $twice.ok) 'the backend refunded twice'

Write-Host "`n== Slot is released ==" -ForegroundColor Cyan
$slotsNow = Api GET "/venues/$venueId/slots?date=$date" $token $null
$released = $slotsNow | Where-Object { $_.id -eq $slot.id }
Check 'the cancelled slot is bookable again' ($released.status -eq 'AVAILABLE') `
    "slot status is $($released.status)"

Write-Host ""
if ($failures.Count -eq 0) {
    Write-Host "ALL CHECKS PASSED" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "$($failures.Count) CHECK(S) FAILED" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
