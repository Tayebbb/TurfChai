# Feature-connectivity audit: which frontend API functions are never called,
# and which backend endpoints have no frontend caller.
Set-Location -Path 'e:\TurfChai\frontend'

$src = (Get-ChildItem -Recurse -Include *.js, *.jsx src |
    Where-Object { $_.FullName -notmatch 'node_modules' }).FullName
$apiFiles = (Get-ChildItem -Recurse -Include *.js src\api).FullName

$exports = @()
foreach ($f in $apiFiles) {
    Select-String -Path $f -Pattern '^export (?:async )?function (\w+)' | ForEach-Object {
        $exports += [pscustomobject]@{
            File = (Split-Path $f -Leaf)
            Name = $_.Matches[0].Groups[1].Value
        }
    }
}

Write-Host '=== ORPHANED frontend API exports (no caller anywhere) ==='
foreach ($e in $exports) {
    # A helper used only by another api module (e.g. apiUpload) is not orphaned,
    # so intra-api callers count too — just not the file that defines it.
    $definingFile = Join-Path (Resolve-Path 'src/api') $e.File
    $uses = Select-String -Path $src -Pattern "\b$($e.Name)\b" |
    Where-Object { $_.Path -ne $definingFile }
    if (-not $uses) { '{0,-30} {1}' -f $e.Name, $e.File }
}

Write-Host ''
Write-Host "total frontend api exports: $($exports.Count)"
