const DEFAULT_THEME = 'glass';
let activeScope = 'global';
let activeTab = null;
let activeCardKey = null;
let activeCardFingerprintKey = null;
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
        const match = pathname.match(/^\/(?:stripe_cards|grants)\/[^/]+/);
        return match ? match[0] : null;
    } catch {
        return null;
    }
};

const getCardFingerprintFromTab = async (tabId) => {
    try {
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const card = document.querySelector('.stripe-card.mt1:not(.deactivated):not(.canceled):not(.canceled-left):not(.canceled-right)');
                const numberText = card?.querySelector('.stripe-card__number')?.textContent || '';
                const last4Match = numberText.match(/\b(\d{4})\b/);
                return last4Match ? `last4:${last4Match[1]}` : null;
            },
        });
        return result || null;
    } catch {
        return null;
    }
};

const getActiveCardKeys = () => {
    return Array.from(new Set([
        activeCardKey,
        activeCardFingerprintKey,
    ].filter(Boolean)));
};

const getScopedTheme = () => {
    if (activeScope === 'card' && activeCardKey) {
        const cardTheme = getActiveCardKeys().map(key => cardThemes[key]).find(Boolean);
        return cardTheme || currentTheme;
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
        settings.cardThemes = { ...settings.cardThemes };
        getActiveCardKeys().forEach(key => {
            settings.cardThemes[key] = theme;
        });
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

const saveCustomImage = async (imageData) => {
    const accountKey = await getHcbAccountKey();
    const data = await chrome.storage.local.get(['customImages']);
    const customImages = data?.customImages || {};
    const accountImages = customImages[accountKey] || {
        global: null,
        cards: {},
    };

    if (activeScope === 'card' && activeCardKey) {
        accountImages.cards = { ...accountImages.cards };
        getActiveCardKeys().forEach(key => {
            accountImages.cards[key] = imageData;
        });
    } else {
        accountImages.global = imageData;
    }

    customImages[accountKey] = accountImages;
    await chrome.storage.local.set({ customImages });
    await chrome.storage.local.remove('customImage');
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
    getActiveCardKeys().forEach(key => {
        delete settings.cardThemes[key];
    });
    cardThemes = settings.cardThemes;

    accountThemes[accountKey] = settings;
    await chrome.storage.sync.set({ accountThemes });

    const localData = await chrome.storage.local.get(['customImages']);
    const customImages = localData?.customImages || {};
    if (customImages[accountKey]?.cards) {
        const accountImages = {
            ...customImages[accountKey],
            cards: { ...customImages[accountKey].cards },
        };
        getActiveCardKeys().forEach(key => {
            delete accountImages.cards[key];
        });
        customImages[accountKey] = accountImages;
        await chrome.storage.local.set({ customImages });
    }

    setActiveScope('card');
    await notifyActiveTab();
};

const exportThemes = async () => {
    const syncData = await chrome.storage.sync.get(['accountThemes']);
    const localData = await chrome.storage.local.get(['customImages']);
    const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        accountThemes: syncData.accountThemes || {},
        customImages: localData.customImages || {},
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `skinner-themes-${Date.now()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const importThemes = async (file) => {
    const text = await file.text();
    const backup = JSON.parse(text);

    if (!backup || backup.version !== 1) {
        throw new Error('Unsupported Skinner backup file');
    }

    if (
        typeof backup.accountThemes !== 'object' ||
        backup.accountThemes === null ||
        typeof backup.customImages !== 'object' ||
        backup.customImages === null
    ) {
        throw new Error('Invalid Skinner backup file');
    }

    await chrome.storage.sync.set({
        accountThemes: backup.accountThemes,
    });
    await chrome.storage.local.set({
        customImages: backup.customImages,
    });
    await chrome.storage.local.remove('customImage');
    await notifyActiveTab();
    await initialize();
};

const initialize = async () => {
    [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeCardKey = activeTab?.url ? getCardKeyFromUrl(activeTab.url) : null;
    activeCardFingerprintKey = activeTab?.id ? await getCardFingerprintFromTab(activeTab.id) : null;

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

document.querySelector('.export-btn')?.addEventListener('click', async () => {
    try {
        updateStatus('Exporting...', '');
        await exportThemes();
        updateStatus('Themes exported', 'success');
    } catch (err) {
        console.error(err);
        updateStatus('Export failed', 'error');
    }
});

document.getElementById('importThemeFile')?.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        updateStatus('Importing...', '');
        await importThemes(file);
        updateStatus('Themes imported', 'success');
    } catch (err) {
        console.error(err);
        updateStatus('Import failed', 'error');
    } finally {
        event.target.value = '';
    }
});

document.getElementById('imageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    updateStatus('Uploading...', '');

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const imageData = event.target.result;
            await saveCustomImage(imageData);
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
