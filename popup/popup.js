const updateStatus = (message, type = '') => {
    const statusEl = document.getElementById('status');
    const bar = document.querySelector('.status-bar');
    if (statusEl) statusEl.textContent = message;
    if (bar) {
        bar.classList.remove('success', 'error');
        if (type) bar.classList.add(type);
    }
};

const setActiveCard = (theme) => {
    document.querySelectorAll('.theme-card').forEach(card => {
        card.classList.toggle('active', card.dataset.theme === theme);
    });
};

// Load current theme on popup open
chrome.storage.sync.get(['theme'], (data) => {
    const theme = data?.theme || 'glass';
    setActiveCard(theme);
    const name = theme === 'off' ? 'Off' : theme.charAt(0).toUpperCase() + theme.slice(1);
    updateStatus(`Active: ${name}`, theme === 'off' ? '' : 'success');
});

// Theme card buttons
document.querySelectorAll('.theme-card, .off-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) { updateStatus('No active tab', 'error'); return; }

        const theme = btn.dataset.theme;
        if (!theme) { updateStatus('Invalid theme', 'error'); return; }

        updateStatus('Applying...', '');
        setActiveCard(theme);

        const site = new URL(tab.url).hostname;
        chrome.storage.sync.set({ theme, [site]: theme });

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (themeName) => {
                const linkId = 'card-skinner-theme';
                let link = document.getElementById(linkId);
                if (!link) {
                    link = document.createElement('link');
                    link.id = linkId;
                    link.rel = 'stylesheet';
                    document.head.appendChild(link);
                }
                link.href = chrome.runtime.getURL(`themes/${themeName}.css`);
                location.reload();
            },
            args: [theme],
        }).then(() => {
            if (theme === 'off') {
                updateStatus('Overlays off', '');
                setActiveCard('');
            } else {
                const name = theme.charAt(0).toUpperCase() + theme.slice(1);
                updateStatus(`Active: ${name}`, 'success');
            }
        }).catch(() => updateStatus('Failed to apply', 'error'));
    });
});

// Image upload
document.getElementById('imageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    updateStatus('Uploading...', '');

    const reader = new FileReader();
    reader.onload = (event) => {
        const imageData = event.target.result;
        chrome.storage.local.set({ customImage: imageData }, () => {
            if (chrome.runtime.lastError) {
                updateStatus('Upload failed', 'error');
                return;
            }
            chrome.storage.sync.set({ theme: 'custom' }, () => {
                updateStatus('Custom image applied!', 'success');
                setActiveCard('');
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) chrome.tabs.reload(tabs[0].id);
                });
            });
        });
    };
    reader.onerror = () => updateStatus('Failed to read image', 'error');
    reader.readAsDataURL(file);
});

// Add event listener for the new button
const offButton = document.querySelector('button[data-theme="off"], button[data-theme="offBtn"]');
if (offButton) {
    offButton.onclick = turnOffOverlays;
}

// Load and display current theme on popup open
chrome.storage.sync.get(['theme'], (data) => {
    const current = data?.theme || 'glass';
    if (current === 'off') {
        updateStatus('Overlays off');
    } else {
        updateStatus(`Active: ${current.charAt(0).toUpperCase() + current.slice(1)}`);
    }
});