# Skinner

Skinner is a Chrome extension for customizing card themes on
<a href="https://hcb.hackclub.com/">HCB</a> (formerly Hack Club Bank)

It lets you apply built-in overlay themes or upload a custom image for your cards.

## Features

- 8 built-in themes with visual previews in the popup:
	- `Glass`: frosted glass blur effect
	- `Neon` : vibrant green-to-purple gradient
	- `Retro` : scanline CRT with red/blue tones
	- `Gradient` : animated purple-pink shifting gradient
	- `Holo` : rainbow holographic shimmer
	- `Minimal` : clean dark card with subtle border
	- `Minecraft` : pixelated grass-block grid
	- `Freeze` : muted icy overlay for frozen cards

## Supported Pages

- `https://hcb.hackclub.com/my/cards`
- `https://hcb.hackclub.com/{organization}/cards`
- `https://hcb.hackclub.com/stripe_cards/{card_id}`
	for now !

## Installation (Developer Mode)

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable `Developer mode` (top-right).
4. Click `Load unpacked`.
5. Select the repository folder (the one containing `manifest.json`).

## Installation (User)
1. Go to <a href="https://github.com/adhyys07/skinner/releases/tag/stable">Skinner Releases</a>
2. Download the latest skinner.zip file.
3. Extract it to a folder
4. Go to browser extension settings, over there enable developer mode because sometimes it does not show option to import folders
5. Over there import the extracted folder.
6. Boom it's installed, check extensions icon to access the skinner UI to change cards UI.


## Usage

1. Open HCB in Chrome.
2. Click the extension icon.
3. Choose a theme from the visual grid.
4. Optional: upload a custom image with `Upload Custom Image`.
5. To restore original card appearance, click `Turn Off Overlays`.

The popup updates storage and triggers theme application in the active tab.

## How It Works

- Content script: `content/injector.js` It injects all the data that is required for skinner to work!
	- Adds/removes `.card-skinner` class
	- All the themes presets are applied via `themes/*.css`
	- Applies custom image when selected
- Popup UI:
	- `popup/popup.html` — theme grid with all card previews
	- `popup/popup.js` — logic handling for theme selection, active state, image upload
	- `popup/popup.css` — it applies the theme and css for card theme selection popup box


## Troubleshooting

- Theme not applying until reload:
	- Navigate once and wait a moment for late DOM hydration.
	- Re-open popup and reapply a theme.
- Canceled cards should remain default:
	- Script explicitly resets canceled/cancelled/deactivated cards.
- Turn Off still shows a faint overlay:
	- Reload the page once after turning off.

## Disclaimer

This project is an unofficial visual customization extension and is not affiliated with Hack Club.

## Point to be Noted

This extension is work in progress and this is just a very rough prototype so you may have bugs, errors and other issues. For the time being you cannot apply different themes to different cards. If you need a feature or want to report a bug then you can DM me on slack <a href="https://hackclub.enterprise.slack.com/team/U082UPTRQU8" target="_blank">~@Adhyys</a>

## For Transparency
I have used AI in this project for bug fixing and modifying some features. Also, created modified card themes wih
