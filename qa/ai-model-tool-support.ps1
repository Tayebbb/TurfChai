$ErrorActionPreference = 'Stop'

$r = Invoke-WebRequest -Uri 'https://openrouter.ai/api/v1/models' -UseBasicParsing
$models = ([System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json).data

$configured = @(
    'inclusionai/ling-3.0-flash:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'google/gemma-4-26b-a4b-it:free'
)

Write-Host '--- currently configured models ---'
foreach ($id in $configured) {
    $m = $models | Where-Object { $_.id -eq $id }
    if (-not $m) { Write-Host "$id  -> NOT LISTED"; continue }
    $tools = $m.supported_parameters -contains 'tools'
    Write-Host ("{0,-42} tools={1}" -f $id, $tools)
}

Write-Host ''
Write-Host '--- free models that DO support tool calling ---'
$models |
    Where-Object { $_.id -like '*:free' -and $_.supported_parameters -contains 'tools' } |
    Sort-Object { -[int]$_.context_length } |
    Select-Object -First 12 |
    ForEach-Object { "{0,-52} ctx={1}" -f $_.id, $_.context_length }
