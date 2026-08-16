# Removes the modules the importer audit proved unreferenced.
Set-Location -Path 'e:\TurfChai\frontend'

$dead = @(
    'src/api/games.js', 'src/api/health.js', 'src/api/ownerStaff.js', 'src/api/ownerVenueSetup.js',
    'src/data/bookings.js', 'src/data/venues.js', 'src/data/games.js',
    'src/data/notifications.js', 'src/data/tournaments.js', 'src/data/users.js'
)

foreach ($file in $dead) {
    if (Test-Path $file) {
        Remove-Item $file
        "deleted $file"
    } else {
        "already gone $file"
    }
}
