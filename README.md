# Skinner

Skinner is a Chrome extension for customizing card themes on
<a href="https://hcb.hackclub.com/">HCB</a> (formerly Hack Club Bank)

It lets you apply built-in overlay themes or upload a custom image for your cards.

## Features

- Built-in themes from the popup:
	- `Glass`
	- `Neon`
	- `Upload your own image!`
- Custom card background image upload (stored in `chrome.storage.local`)
- Theme persists with the help of `chrome.storage.sync`
- Safety exclusions:
	- canceled/deactivated cards are reset to provider default visuals

## Supported Pages

- `https://hcb.hackclub.com/my/cards`
- `https://hcb.hackclub.com/{organization}/cards`
   for now !
On organization cards pages, theme application is scoped to user-owned cards using ownership matching.

## Installation (Developer Mode)

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable `Developer mode` (top-right).
4. Click `Load unpacked`.
5. Select the repository folder (the one containing `manifest.json`).

## Usage

1. Open HCB in Chrome.
2. Click the extension icon.
3. Choose a theme:
	 - `Glass`
	 - `Neon`
	 - `Turn Off Overlays`
4. Optional: upload a custom image with `Upload Custom Image`.

The popup updates storage and triggers theme application in the active tab.

## How It Works

- Content script: `content/injector.js`
	- Adds/removes `.card-skinner` class
	- Applies theme stylesheet via `themes/*.css`
	- Applies custom image when selected
	- Handles SPA route changes, visibility/focus restoration, and fallback re-apply logic
- Popup UI:
	- `popup/popup.html`
	- `popup/popup.js`


## Project Structure

```text
manifest.json
assets/
content/
	injector.js
popup/
	popup.html
	popup.css
	popup.js
themes/
	glass.css
	neon.css
	freeze.css
	minecraft.css
	custom.css
utils/
	siteMap.js
```

## Permissions

From `manifest.json`:

- `storage`
- `activeTab`
- `scripting`
- Host permission: `https://hcb.hackclub.com/*`

## Troubleshooting

- Theme not applying until reload:
	- Navigate once and wait a moment for late DOM hydration.
	- Re-open popup and reapply a theme.
- Theme appears on wrong cards in org view:
	- Ownership matching depends on current HCB DOM labels/classes.
	- If HCB updates markup, matching may need selector updates in `content/injector.js`.
- Canceled cards should remain default:
	- Script explicitly resets canceled/cancelled/deactivated cards.

## Disclaimer

This project is an unofficial visual customization extension and is not affiliated with Hack Club.

# Point to be Noted

This extension is work in progress and this is just a very rough prototype so you may have bugs, errors and other issues. For the time being you cannot apply different themes to different cards. If you need a feature or want to report a bug then you can DM me on slack ~@Adhyys

## For Transparency
I have used AI in this project for bug fixing and modifying some features.
