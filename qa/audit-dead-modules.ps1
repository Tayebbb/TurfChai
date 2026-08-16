# Confirms each candidate module has no importer left before it is deleted.
Set-Location -Path 'e:\TurfChai\frontend'

$targets = @(
    'api/games', 'api/health', 'api/ownerStaff', 'api/ownerVenueSetup',
    'data/bookings', 'data/venues', 'data/games', 'data/notifications',
    'data/tournaments', 'data/users', 'data/owner', 'data/admin'
)

$src = (Get-ChildItem -Recurse -Include *.js, *.jsx src |
        Where-Object { $_.FullName -notmatch 'node_modules' }).FullName

foreach ($t in $targets) {
    $ownFile = (Resolve-Path "src/$t.js" -ErrorAction SilentlyContinue)
    $hits = Select-String -Path $src -Pattern ([regex]::Escape("@/$t'")) |
            Where-Object { -not $ownFile -or $_.Path -ne $ownFile.Path }
    '{0,-26} importers: {1}' -f $t, $hits.Count
    $hits | ForEach-Object { "    $($_.Filename):$($_.LineNumber)" }
}
