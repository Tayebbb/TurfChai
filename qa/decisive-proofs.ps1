$ErrorActionPreference='Stop'
function Api { param($M,$P,$B,$H=@{})
  $a=@{Uri="http://localhost:8080$P";Method=$M;Headers=$H;UseBasicParsing=$true;TimeoutSec=30}
  if($null -ne $B){$a.Body=($B|ConvertTo-Json -Depth 6);$a.ContentType='application/json'}
  try{$r=Invoke-WebRequest @a; return [pscustomobject]@{s=[int]$r.StatusCode;b=$r.Content}}
  catch{$c=0;if($_.Exception.Response){$c=[int]$_.Exception.Response.StatusCode.value__}
    $m=$_.ErrorDetails.Message; if(-not $m){$m=$_.Exception.Message}
    return [pscustomobject]@{s=$c;b=$m}}
}
function L($e,$p){ (Api POST '/api/v1/auth/login' @{email=$e;password=$p}).b | ConvertFrom-Json }

$A=L 'qa.player.a@turfchai.test' 'QaPass@12345'
$B=L 'qa.player.b@turfchai.test' 'QaPass@12345'
$Z=L 'qa.player.zero@turfchai.test' 'QaPass@12345'
$SO=L 'qa.solo.a@turfchai.test' 'QaPass@12345'
$BH=@{Authorization="Bearer $($B.token)"}
$ZH=@{Authorization="Bearer $($Z.token)"}
$ds=Get-Content "$PSScriptRoot\baseline\qa-dataset.json" -Raw | ConvertFrom-Json
$bkB=($ds.bookings | Where-Object {$_.label -eq 'playerB_upcoming_confirmed'})[0]

Write-Host "=== PROOF A: did playerB's FORGED review (userId=playerA) persist? ===" -ForegroundColor Cyan
$r=Api POST '/api/v1/reviews' @{bookingId=$bkB.id;userId=$A.user.id;venueId=$bkB.venueId;overallRating=1;subRatings=@{};comment='TC-007 forged authorship';parentReview=$false} $BH
Write-Host ("  re-POST identical forged payload -> status={0}" -f $r.s)
Write-Host ("  body: {0}" -f ($r.b -replace '\s+',' '))
Write-Host ("  VERDICT: {0}" -f $(if($r.s -eq 400){'400 duplicate => the forged review row WAS written by the request that returned 500'}else{'inconclusive'}))

Write-Host "`n=== PROOF B: does /join use the body userId instead of the caller? ===" -ForegroundColor Cyan
Write-Host ("  caller=playerZero(id={0}) posts userId=soloPlayer(id={1}), who is NOT on the roster" -f $Z.user.id,$SO.user.id)
$j=Api POST "/api/v1/solo/open-games/$($ds.openGame.id)/join" @{userId=$SO.user.id;paymentMethod='bKash'} $ZH
Write-Host ("  join status={0} body={1}" -f $j.s, ($j.b -replace '\s+',' '))
$m=(Api GET "/api/v1/solo/open-games/$($ds.openGame.id)/members").b | ConvertFrom-Json
$ids=@($m | ForEach-Object {$_.userId})
Write-Host ("  roster userIds now: {0}" -f ($ids -join ','))
$verdict = if(($ids -contains $SO.user.id) -and -not ($ids -contains $Z.user.id)) { 'SERVER TRUSTS BODY userId -> caller enrolled a DIFFERENT user (IDOR)' }
           elseif($ids -contains $Z.user.id) { 'server used the authenticated principal (safe)' }
           else { 'inconclusive' }
Write-Host ("  VERDICT: {0}" -f $verdict) -ForegroundColor Yellow

Write-Host "`n=== PROOF C: total review rows written by failing requests ===" -ForegroundColor Cyan
$v=(Api GET '/api/v1/venues/kick-off-arena').b | ConvertFrom-Json
$v2=(Api GET '/api/v1/venues/mirpur-sports-city').b | ConvertFrom-Json
Write-Host ("  kick-off-arena   rating={0} reviewCount={1} (seeded 4.8 / 214)" -f $v.rating,$v.reviewCount)
Write-Host ("  mirpur-sports-city rating={0} reviewCount={1} (seeded 4.7 / 301)" -f $v2.rating,$v2.reviewCount)

$out=[ordered]@{
  proofA_forgedReviewPersisted=[ordered]@{status=$r.s;body=($r.b -replace '\s+',' ');verdict=$(if($r.s -eq 400){'PERSISTED'}else{'inconclusive'})}
  proofB_joinIdentity=[ordered]@{callerId=$Z.user.id;bodyUserId=$SO.user.id;status=$j.s;roster=$ids;verdict=$verdict}
  proofC_venueRatingsCorrupted=[ordered]@{
    kickOffArena=[ordered]@{ratingNow=$v.rating;reviewCountNow=$v.reviewCount;seededRating=4.8;seededReviewCount=214}
    mirpurSportsCity=[ordered]@{ratingNow=$v2.rating;reviewCountNow=$v2.reviewCount;seededRating=4.7;seededReviewCount=301}
  }
}
$out | ConvertTo-Json -Depth 8 | Set-Content "$PSScriptRoot\baseline\qa-findings-proofs.json" -Encoding UTF8
Write-Host "`nWritten baseline\qa-findings-proofs.json" -ForegroundColor Green
