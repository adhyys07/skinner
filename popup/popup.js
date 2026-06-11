const DEFAULT_THEME = 'glass';
let activeScope = 'global';
let activeTab = null;
let activeCardKey = null;
let currentTheme = DEFAULT_THEME;
let cardThemes = {};

async function getHcbAccountKey() {
    try {
        const [tab] = await chrome.tabs.query({active : true, currentWindow: true});
        if (!tab?.id) return 'unknown-account';

        const [{ result }] = await chrome.scripting.executeScript({
            target : {tabId: tab.id},
            func: async () => {
                try {
                    const response = await fetch('/api/current_user', {
                        credentials : 'include',
                    });

                    if (!response.ok) return 'unknown-account';

                    const user = await response.json();
                    return String(user.id || user.email || user.name || 'unknown-account');
                } catch {
                    return 'unknown-account';
                }
            },
        });

        return result || 'unknown-account';
    } catch{
        return 'unknown-account';
    }
}

const updateStatus = (message, type = '') => {
    const statusEl = document.getElementById('status');
    const bar = document.querySelector('.status-bar');
    if (statusEl) statusEl.textContent = message;
    if (bar) {
        bar.classList.remove('success', 'error');
        if (type) bar.classList.add(type);
    }
};

const themeName = (theme) => theme === 'off' ? 'Off' : theme.charAt(0).toUpperCase() + theme.slice(1);

const getCardKeyFromUrl = (url) => {
    try {
        const { pathname } = new URL(url);
        const match = pathname.match(/^\/stripe_cards\/[^/]+/);
        return match ? match[0] : null;
    } catch {
        return null;
    }
};

const getScopedTheme = () => {
    if (activeScope === 'card' && activeCardKey) {
        return cardThemes[activeCardKey] || currentTheme;
    }
    return currentTheme;
};

const setActiveCard = (theme) => {
    document.querySelectorAll('.theme-card').forEach(card => {
        card.classList.toggle('active', card.dataset.theme === theme);
    });
};

const setActiveScope = (scope) => {
    activeScope = scope === 'card' && activeCardKey ? 'card' : 'global';
    document.querySelectorAll('.scope-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.scope === activeScope);
    });

    const cardButton = document.querySelector('.scope-btn[data-scope="card"]');
    if (cardButton) cardButton.disabled = !activeCardKey;

    const resetButton = document.querySelector('.reset-card-btn');
    if (resetButton) resetButton.style.display = activeScope === 'card' ? '' : 'none';

    const theme = getScopedTheme();
    setActiveCard(theme);
    updateStatus(activeScope === 'card'
        ? `This card: ${themeName(theme)}`
        : `Global: ${themeName(theme)}`,
        theme === 'off' ? '' : 'success');
};

const notifyActiveTab = async () => {
    if (!activeTab?.id) return;
    try {
        await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => window.dispatchEvent(new CustomEvent('card-skinner-storage-changed')),
        });
    } catch (err) {
        console.warn('Card Skinner content script was not available in this tab.', err);
    }
};

const saveTheme = async (theme) => {
    const accountKey = await getHcbAccountKey();
    const data = await chrome.storage.sync.get(['accountThemes']);
    const accountThemes = data?.accountThemes || {};
    const settings = accountThemes[accountKey] || {
        theme: DEFAULT_THEME,
        cardThemes: {},
    };

    if (activeScope === 'card' && activeCardKey) {
        settings.cardThemes = {
            ...settings.cardThemes,
            [activeCardKey]: theme,
        };
        cardThemes = settings.cardThemes;
    } else {
        settings.theme = theme;
        currentTheme = theme;
    }

    accountThemes[accountKey] = settings;
    await chrome.storage.sync.set({ accountThemes });

    setActiveCard(theme);
    updateStatus(activeScope === 'card'
        ? `This card: ${themeName(theme)}`
        : `Global: ${themeName(theme)}`,
        theme === 'off' ? '' : 'success');
    await notifyActiveTab();
};

const resetCurrentCard = async () => {
    if (!activeCardKey) {
        updateStatus('Open a card page first', 'error');
        return;
    }

    const accountKey = await getHcbAccountKey();
    const data = await chrome.storage.sync.get(['accountThemes']);
    const accountThemes = data?.accountThemes || {};
    const settings = accountThemes[accountKey] || {
        theme: DEFAULT_THEME,
        cardThemes: {},
    };

    settings.cardThemes = { ...settings.cardThemes };
    delete settings.cardThemes[activeCardKey];
    cardThemes = settings.cardThemes;

    accountThemes[accountKey] = settings;
    await chrome.storage.sync.set({ accountThemes });

    setActiveScope('card');
    await notifyActiveTab();
};

const initialize = async () => {
    [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeCardKey = activeTab?.url ? getCardKeyFromUrl(activeTab.url) : null;

    const accountKey = await getHcbAccountKey();
    const data = await chrome.storage.sync.get(['accountThemes']);
    const accountThemes = data?.accountThemes || {};
    const settings = accountThemes[accountKey] || {};

    currentTheme = settings.theme || DEFAULT_THEME;
    cardThemes = settings.cardThemes || {};

    setActiveScope(activeCardKey ? 'card' : 'global');
};

document.querySelectorAll('.scope-btn').forEach(btn => {
    btn.addEventListener('click', () => setActiveScope(btn.dataset.scope));
});

document.querySelectorAll('.theme-card, .off-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const theme = btn.dataset.theme;
        if (!theme) {
            updateStatus('Invalid theme', 'error');
            return;
        }

        updateStatus('Applying...', '');
        try {
            await saveTheme(theme);
        } catch (err) {
            console.error(err);
            updateStatus('Failed to apply', 'error');
        }
    });
});

document.querySelector('.reset-card-btn')?.addEventListener('click', () => {
    resetCurrentCard().catch(err => {
        console.error(err);
        updateStatus('Failed to reset card', 'error');
    });
});

document.getElementById('imageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    updateStatus('Uploading...', '');

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const imageData = event.target.result;
            await chrome.storage.local.set({ customImage: imageData });
            await saveTheme('custom');
            updateStatus(activeScope === 'card' ? 'Custom image on this card' : 'Custom image applied', 'success');
        } catch (err) {
            console.error(err);
            updateStatus('Upload failed', 'error');
        }
    };
    reader.onerror = () => updateStatus('Failed to read image', 'error');
    reader.readAsDataURL(file);
});

initialize().catch(err => {
    console.error(err);
    updateStatus('Could not load settings', 'error');
});
