# Final sweep: any click handler whose entire body is a toast is a fake control.
Set-Location -Path 'e:\TurfChai\frontend'
$files = (Get-ChildItem -Recurse -Include *.jsx, *.js src |
    Where-Object { $_.FullName -notmatch 'node_modules|\.test\.' }).FullName

Write-Host '--- single-line toast-only handlers ---'
Select-String -Path $files -Pattern 'onClick=\{\(\) => showToast\(' |
    ForEach-Object { "$($_.Filename):$($_.LineNumber): $($_.Line.Trim())" }

Write-Host ''
Write-Host '--- multi-line onClick whose next statement is a toast ---'
Select-String -Path $files -Pattern 'showToast\(' -Context 1, 0 |
    Where-Object { $_.Context.PreContext -match 'onClick=\{\(\) =>\s*$' } |
    ForEach-Object { "$($_.Filename):$($_.LineNumber): $($_.Line.Trim())" }

Write-Host ''
Write-Host '--- toast inside a catch block (success claimed on failure) ---'
Select-String -Path $files -Pattern 'catch' -Context 0, 3 |
    Where-Object { ($_.Context.PostContext -join ' ') -match "showToast\('[^']*(\u2713|success|sent|saved|done)" } |
    ForEach-Object { "$($_.Filename):$($_.LineNumber): $($_.Line.Trim())" }
