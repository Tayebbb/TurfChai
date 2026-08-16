<#
    Independent re-scan for dead / non-functional interactive controls.
    Does not reuse the previous audit's result set.

    Detects:
      A. inline handlers whose whole body is a single showToast(...) / alert(...)
      B. named handler functions whose entire body is a single showToast(...)
      C. <button> elements with no onClick, no type=submit and no `to`
      D. confirm() / alert() usage
      E. console.log / console.error left in page code
#>
param([string]$Root = "$PSScriptRoot\..\frontend\src",
      [string]$OutFile = "$PSScriptRoot\baseline\qa-dead-controls.json")
$ErrorActionPreference = 'Stop'
$files = Get-ChildItem -Path $Root -Recurse -Include *.jsx, *.js
$inline = @(); $named = @(); $noHandler = @(); $dialogs = @(); $logs = @()

foreach ($f in $files) {
    $rel = $f.FullName.Substring((Resolve-Path $Root).Path.Length).TrimStart('\')
    $lines = Get-Content $f.FullName
    $text = ($lines -join "`n")

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $ln = $lines[$i]; $no = $i + 1

        # A. inline arrow handler that only shows a toast
        if ($ln -match '(onClick|onToggle|onChange|onSubmit)=\{\s*\(\s*\)\s*=>\s*(showToast|alert)\s*\(') {
            # label: nearest preceding/inline text
            $label = ''
            if ($ln -match '>([^<>{}]{2,40})<') { $label = $matches[1].Trim() }
            if (-not $label -and $i + 1 -lt $lines.Count -and $lines[$i+1] -match '^\s*([^<>{}\s][^<>{}]{1,40})\s*$') { $label = $matches[1].Trim() }
            $inline += [ordered]@{ file = $rel; line = $no; label = $label; code = $ln.Trim() }
        }

        # D. native dialogs
        if ($ln -match '\b(confirm|alert)\s*\(' -and $ln -notmatch 'showToast') {
            $dialogs += [ordered]@{ file = $rel; line = $no; code = $ln.Trim() }
        }

        # E. console statements
        if ($ln -match '\bconsole\.(log|error|warn|debug)\s*\(') {
            $logs += [ordered]@{ file = $rel; line = $no; code = $ln.Trim() }
        }
    }

    # B. named handlers whose entire body is one showToast call
    foreach ($m in [regex]::Matches($text, '(?m)^\s*(?:const|function)\s+(\w+)\s*=?\s*(?:\([^)]*\)|\w+)\s*=>?\s*\{\s*\n\s*showToast\([^\n]*\);?\s*\n\s*\}')) {
        $ln = ($text.Substring(0, $m.Index) -split "`n").Count
        $named += [ordered]@{ file = $rel; line = $ln; handler = $m.Groups[1].Value; code = ($m.Value -replace '\s+', ' ').Trim() }
    }

    # C. <button> with no onClick / type=submit / to=
    foreach ($m in [regex]::Matches($text, '<button\b[^>]*>')) {
        $tag = $m.Value
        if ($tag -notmatch 'onClick' -and $tag -notmatch 'type=\{?["'']?submit' -and $tag -notmatch '\bto=') {
            $ln = ($text.Substring(0, $m.Index) -split "`n").Count
            $noHandler += [ordered]@{ file = $rel; line = $ln; tag = ($tag -replace '\s+', ' ') }
        }
    }
}

$pages = { param($set) @($set | Where-Object { $_.file -like 'pages\*' -or $_.file -like 'host\*' -or $_.file -like 'solo\*' -or $_.file -like 'layouts\*' -or $_.file -like 'public\*' -or $_.file -like 'auth\*' }) }

$result = [ordered]@{
    generatedAt = (Get-Date).ToString('o')
    scannedFiles = $files.Count
    summary = [ordered]@{
        inlineToastOnlyHandlers = $inline.Count
        namedToastOnlyHandlers  = $named.Count
        buttonsWithoutHandler   = $noHandler.Count
        nativeDialogs           = $dialogs.Count
        consoleStatements       = $logs.Count
    }
    inlineToastOnlyHandlers = $inline
    namedToastOnlyHandlers  = $named
    buttonsWithoutHandler   = $noHandler
    nativeDialogs           = $dialogs
    consoleStatements       = $logs
}
New-Item -ItemType Directory -Force -Path (Split-Path $OutFile) | Out-Null
$result | ConvertTo-Json -Depth 8 | Set-Content $OutFile -Encoding UTF8

Write-Host "Scanned $($files.Count) files" -ForegroundColor Cyan
Write-Host ("inline toast-only handlers : {0}" -f $inline.Count) -ForegroundColor Yellow
Write-Host ("named  toast-only handlers : {0}" -f $named.Count) -ForegroundColor Yellow
Write-Host ("buttons with no handler    : {0}" -f $noHandler.Count) -ForegroundColor Yellow
Write-Host ("confirm()/alert() calls    : {0}" -f $dialogs.Count) -ForegroundColor Yellow
Write-Host ("console.* statements       : {0}" -f $logs.Count) -ForegroundColor Yellow
Write-Host "`n--- inline toast-only handlers ---"
$inline | ForEach-Object { "{0}:{1}  {2}" -f $_.file, $_.line, ($_.code.Substring(0, [Math]::Min(110, $_.code.Length))) }
Write-Host "`n--- named toast-only handlers ---"
$named | ForEach-Object { "{0}:{1}  {2}()  {3}" -f $_.file, $_.line, $_.handler, ($_.code.Substring(0, [Math]::Min(90, $_.code.Length))) }
Write-Host "`n--- native dialogs ---"
$dialogs | ForEach-Object { "{0}:{1}  {2}" -f $_.file, $_.line, ($_.code.Substring(0, [Math]::Min(100, $_.code.Length))) }
Write-Host "`nWritten $OutFile" -ForegroundColor Green
