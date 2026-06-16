# Skinner

Skinner is an unofficial Chrome extension for customizing HCB card visuals on
[hcb.hackclub.com](https://hcb.hackclub.com/).

It lets you apply built-in themes globally, override individual cards, use custom
images, and back up or restore your Skinner settings.

## Features

- 8 built-in themes:
  - `Glass`: frosted glass effect
  - `Neon`: green-to-purple gradient
  - `Retro`: CRT-inspired red/blue theme
  - `Gradient`: animated purple-pink gradient
  - `Holo`: rainbow holographic shimmer
  - `Minimal`: clean dark card
  - `Minecraft`: pixelated grass-block grid
  - `Animated`: moving multicolor gradient
- Global default theme from the extension popup.
- Popup mode and optional Chrome sidebar mode.
- Per-card themes using the in-card `Skin` button.
- Per-card themes from the popup when viewing a specific card or grant page.
- Per-organization themes from supported organization pages.
- Theme presets with save and apply controls.
- Theme-code sharing: copy a theme code to share or paste one to import.
- Random Theme: pick a random built-in theme instantly.
- Random Daily: picks a different random theme each day, consistent within the day.
- Custom editor controls for background color, text color, and glow intensity.
- Grant banner sync modes for card-only, banner-only, both, or off.
- Custom card images from file upload, with built-in browser resizing/upscaling.
- Custom card images from direct image URLs.
- Turn Off Overlays to disable all Skinner theming and custom images globally.
- Per-account settings, so different HCB accounts in the same browser profile do not share themes.
- Automatic local backup of settings on each save (up to 5 snapshots per account).
- Export/import for saved themes and custom images.
- Grant card pages can theme the grant header to match the selected card theme.
- Canceled/deactivated cards are skipped so Skinner does not apply themes to them.

## Supported Pages

- `https://hcb.hackclub.com/`
- `https://hcb.hackclub.com/my/cards`
- `https://hcb.hackclub.com/{organization}/cards`
- `https://hcb.hackclub.com/stripe_cards/{card_id}`
- `https://hcb.hackclub.com/grants/{grant_id}`

On organization card pages, Skinner only themes cards that appear to belong to
the signed-in HCB user. Other people's cards should keep the official HCB design.

## Installation

### Developer Mode

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the repository folder containing `manifest.json`.

### Release Build

1. Go to the [Skinner releases](https://github.com/adhyys07/skinner/releases).
2. Download the latest `skinner.zip`.
3. Extract it to a folder.
4. Open your browser extension settings and enable developer mode.
5. Load the extracted folder as an unpacked extension.

## Usage

### Global Theme

1. Open HCB.
2. Click the Skinner extension icon.
3. Choose `Global`.
4. Pick a theme.

The global theme is used as the default for your cards unless a card has its own
override.

### Popup And Sidebar

- Click the extension icon to use Skinner as a popup.
- Click `Open Sidebar` to keep Skinner open in Chrome's side panel while you browse HCB.
- Use the sidebar close button or Chrome's side panel close control to close it.

### Per-Card Theme

Use either method:

- Click the `Skin` button on a card and choose a theme.
- Open a card/grant detail page, choose `This card` in the popup, then select a theme.

Use `Use Global Theme` to remove a card-specific override.

### Per-Organization Theme

On an organization's card page, open the advanced tools section in the popup and click
`Use Theme for this Org` to apply the current theme to all cards for that organization.
Use `Reset Org` to clear the organization override.

### Custom Images

- Use `Upload Custom Image` to choose an image file.
- Use `Image URL` to apply a direct image link.

If `This card` is selected, the image applies only to that card. If `Global` is
selected, the image becomes the global custom-image theme.

### Turn Off Overlays

Click `Turn Off Overlays` to disable all Skinner themes and custom images. Cards
will revert to the default HCB design. Select any theme to re-enable Skinner.

### Advanced Controls

Open the advanced tools section for additional controls:

- **Presets**: Save the current theme and editor settings as a named preset, then apply it later.
- **Random Theme**: Immediately apply a random built-in theme.
- **Random Daily**: Apply a random built-in theme that stays the same for the whole day and changes the next day.
- **Banner Sync**: Choose whether Skinner themes the card, the grant banner, both, or neither.
- **Custom Theme Editor**: Set a custom background color, text color, and glow level, then click `Save Custom Theme`.
- **Theme Codes**: Click `Copy Theme Code` to get a shareable code for the current theme settings. Paste a code into the input and click `Import Theme Code` to apply someone else's theme.
- **Reset Controls**: `Reset Card` clears the override for the active card. `Reset Org` clears the organization override. `Reset Images` removes all custom images. `Reset Everything` removes all saved Skinner data.

### Export And Import

- `Export Themes` downloads a JSON backup of saved themes and custom images.
- `Import Themes` restores a previously exported Skinner backup.

The backup includes:

- `chrome.storage.sync.accountThemes` — all per-account theme, preset, editor, and org settings
- `chrome.storage.local.customImages` — all uploaded custom card images

Skinner also automatically saves up to 5 local snapshots of your settings each time
you make a change. These are stored in `chrome.storage.local.accountBackups` and are
separate from the manual export.

## How It Works

- `content/injector.js`
  - Loads account-scoped theme settings.
  - Adds/removes `.card-skinner` and `data-skinner-theme`.
  - Injects scoped theme CSS from `themes/*.css`.
  - Adds the per-card `Skin` menu.
  - Applies per-card and global custom images.
  - Watches HCB navigation and Turbo updates.
- `content/applyTheme.js`
  - Utility used by the injector to swap the active theme stylesheet link.
- `popup/popup.html`
  - Theme grid, scope selector, image upload, URL image input, sidebar controls, preset/editor/reset controls, export/import controls.
- `popup/popup.js`
  - Handles theme selection, per-card and per-org overrides, presets, random themes, editor settings, image storage, export/import, and active tab refresh.
- `popup/sidepanel.html`
  - Hosts the popup UI inside an iframe when opened as a Chrome side panel.
- `popup/popup.css`
  - Styles the popup UI.

## Troubleshooting

- Theme not applying:
  - Reload the unpacked extension from `chrome://extensions`.
  - Hard-refresh the HCB page.
- A card uses the wrong theme across pages:
  - Reapply the per-card theme once from that card's detail page or in-card `Skin` menu.
- Custom image URL does not render:
  - Use a direct image URL. Some sites block hotlinking.
- Canceled cards look different from themed cards:
  - That is expected. Skinner skips canceled/deactivated cards.

## Disclaimer

Skinner is unofficial and is not affiliated with Hack Club or HCB.

## Transparency

AI tools have been used for parts of development, bug fixing, and feature work.
