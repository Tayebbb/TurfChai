<#
    Follow-up probes that needed corrected payloads or a third identity.
    Appends to qa\baseline\qa-findings-api.json is NOT done here; results are
    printed and captured into qa\baseline\qa-findings-followup.json.
#>
param([string]$BaseUrl='http://localhost:8080',
      [string]$OutFile="$PSScriptRoot\baseline\qa-findings-followup.json")
$ErrorActionPreference='Stop'
function Api { param($M,$P,$B,$H=@{})
  $a=@{Uri="$BaseUrl$P";Method=$M;Headers=$H;UseBasicParsing=$true;TimeoutSec=30}
  if($null -ne $B){$a.Body=($B|ConvertTo-Json -Depth 6);$a.ContentType='application/json'}
  try{$r=Invoke-WebRequest @a; [pscustomobject]@{status=[int]$r.StatusCode;body=$r.Content}}
  catch{$c=0;if($_.Exception.Response){$c=[int]$_.Exception.Response.StatusCode.value__}
    [pscustomobject]@{status=$c;body=$(if($_.ErrorDetails.Message){$_.ErrorDetails.Message}else{$_.Exception.Message})}}
}
function Login($e,$p){ (Api POST '/api/v1/auth/login' @{email=$e;password=$p}).body | ConvertFrom-Json }
$PW='QaPass@12345'
$A=Login 'qa.player.a@turfchai.test' $PW
$B=Login 'qa.player.b@turfchai.test' $PW
$Z=Login 'qa.player.zero@turfchai.test' $PW
$AH=@{Authorization="Bearer $($A.token)"};$ZH=@{Authorization="Bearer $($Z.token)"}
$out=[ordered]@{}

Write-Host "`n-- TC-005 persistence proof: venue rating recalculated by the failed review --" -ForegroundColor Cyan
$v=(Api GET '/api/v1/venues/kick-off-arena').body | ConvertFrom-Json
Write-Host ("kick-off-arena rating={0} reviewCount={1}  (seeded values were 4.8 / 214)" -f $v.rating,$v.reviewCount)
$out.tc005_persistence=[ordered]@{
  venueSlug='kick-off-arena'; ratingNow=$v.rating; reviewCountNow=$v.reviewCount
  seededRating=4.8; seededReviewCount=214
  conclusion='If reviewCount changed, ReviewService.recalculateVenueRating() committed, proving the review row persisted despite the HTTP 500.'
}

Write-Host "`n-- QA-N06b: does /join trust the userId in the body? (playerZero posts userId=playerA) --" -ForegroundColor Cyan
$og=(Get-Content "$PSScriptRoot\baseline\qa-dataset.json" -Raw | ConvertFrom-Json).openGame
$j=Api POST "/api/v1/solo/open-games/$($og.id)/join" @{userId=$A.user.id;paymentMethod='bKash'} $ZH
$members=(Api GET "/api/v1/solo/open-games/$($og.id)/members").body | ConvertFrom-Json
Write-Host ("join status={0} body={1}" -f $j.status, ($j.body -replace '\s+',' '))
Write-Host ("roster userIds: {0}" -f (($members | ForEach-Object { $_.userId }) -join ','))
$out.qaN06b_join_identity=[ordered]@{
  callerUserId=$Z.user.id; bodyUserId=$A.user.id; status=$j.status
  body=($j.body -replace '\s+',' '); rosterUserIds=@($members | ForEach-Object { $_.userId })
  conclusion=$(if(@($members | ForEach-Object { $_.userId }) -contains $Z.user.id){'Server used the authenticated principal (safe)'}
               elseif($j.status -eq 200){'Server trusted the body userId - IDOR'}else{'inconclusive'})
}

Write-Host "`n-- QA-N10b: promo validation with the correct DTO (code, orderTotal, venueId) --" -ForegroundColor Cyan
$ds=Get-Content "$PSScriptRoot\baseline\qa-dataset.json" -Raw | ConvertFrom-Json
$p1=Api POST '/api/v1/promotions/validate-code' @{code='QA20';orderTotal=1000;venueId=$ds.ownerAVenue.id}
$p2=Api POST '/api/v1/promotions/validate-code' @{code='NOPE404';orderTotal=1000;venueId=$ds.ownerAVenue.id}
$p3=Api POST '/api/v1/promotions/validate-code' @{code='QA20';orderTotal=1000}
$p4=Api POST '/api/v1/promotions/validate-code' @{code='QA20';orderTotal=-5;venueId=$ds.ownerAVenue.id}
Write-Host ("valid={0} bogus={1} noVenue={2} negativeTotal={3}" -f $p1.status,$p2.status,$p3.status,$p4.status)
Write-Host ("valid body: {0}" -f ($p1.body -replace '\s+',' '))
$out.qaN10b_promo=[ordered]@{
  validScoped=[ordered]@{status=$p1.status;body=($p1.body -replace '\s+',' ')}
  bogus=[ordered]@{status=$p2.status;body=($p2.body -replace '\s+',' ')}
  noVenueScope=[ordered]@{status=$p3.status;body=($p3.body -replace '\s+',' ')}
  negativeOrderTotal=[ordered]@{status=$p4.status;body=($p4.body -replace '\s+',' ')}
  unauthenticated=$true
}

Write-Host "`n-- TC-006b: does check-in of a CANCELLED booking succeed? --" -ForegroundColor Cyan
$cancelled=($ds.bookings | Where-Object { $_.label -eq 'playerA_cancelled' })[0]
$cb=Api POST "/api/v1/matchday/checkin?bookingId=$($cancelled.id)" $null $AH
Write-Host ("check-in on CANCELLED booking {0} -> {1}" -f $cancelled.id,$cb.status)
$out.tc006b_cancelled_checkin=[ordered]@{bookingId=$cancelled.id;status=$cb.status;body=($cb.body -replace '\s+',' ')
  conclusion='Checking in a cancelled booking should be rejected.'}

Write-Host "`n-- QA-N12: booking a slot that another user already BOOKED / a BLOCKED slot --" -ForegroundColor Cyan
$blocked=$ds.blockedSlotId
$hb=Api POST '/api/v1/bookings/hold-slot' @{slotId=$blocked} $ZH
Write-Host ("hold BLOCKED slot {0} -> {1}" -f $blocked,$hb.status)
$out.qaN12_blocked_slot=[ordered]@{slotId=$blocked;holdStatus=$hb.status;body=($hb.body -replace '\s+',' ')}

Write-Host "`n-- QA-N13: negative / oversized wallet application at checkout --" -ForegroundColor Cyan
$freeSlot=($ds.ownerSlots | Where-Object { $_.status -eq 'AVAILABLE' } | Select-Object -Last 1)
Api POST '/api/v1/bookings/hold-slot' @{slotId=$freeSlot.id} $ZH | Out-Null
$w1=Api POST '/api/v1/payments/checkout' @{slotId=$freeSlot.id;method='BKASH';applyWalletAmount=-500} $ZH
$w2=Api POST '/api/v1/payments/checkout' @{slotId=$freeSlot.id;method='BKASH';applyWalletAmount=999999} $ZH
Write-Host ("negativeWallet={0} hugeWallet={1}" -f $w1.status,$w2.status)
$out.qaN13_wallet=[ordered]@{negative=[ordered]@{status=$w1.status;body=($w1.body -replace '\s+',' ')}
  huge=[ordered]@{status=$w2.status;body=(($w2.body -replace '\s+',' '))}}

New-Item -ItemType Directory -Force -Path (Split-Path $OutFile) | Out-Null
$out | ConvertTo-Json -Depth 8 | Set-Content $OutFile -Encoding UTF8
Write-Host "`nWritten $OutFile" -ForegroundColor Green
