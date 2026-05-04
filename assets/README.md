# Game Assets

Drop files into these folders with any file name. The game sorts sprite frames by file name and randomly picks from sounds in the matching folder.

When you run the local dev server with `powershell -ExecutionPolicy Bypass -File tools/dev-server.ps1`, new files are discovered on every refresh.

If you open the HTML file directly, run `powershell -ExecutionPolicy Bypass -File tools/update_asset_manifest.ps1` after adding or removing assets.

## Music

- `music/menu` plays on the menu.
- `music/wave` plays during normal zombie waves.
- `music/boss` plays when Don Bosco appears.

## Sound Effects

- `sfx/pistol`
- `sfx/shotgun`
- `sfx/knife`
- `sfx/hit`
- `sfx/death`
- `sfx/hurt`
- `sfx/reload`
- `sfx/boss-roar`
- `sfx/win`
- `sfx/pickup`

## Sprites

- `sprites/player`
- `sprites/zombie`
- `sprites/boss`

Use transparent PNG/WebP frames when you can. JPGs work too, but they draw their background.
