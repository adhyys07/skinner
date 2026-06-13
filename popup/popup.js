const DEFAULT_THEME = 'glass';
let activeScope = 'global';
let activeTab = null;
let activeCardKey = null;
let activeCardFingerprintKey = null;
let activeOrgKey = null;
let currentTheme = DEFAULT_THEME;
let cardThemes = {};
let accountKeyPromise = null;

async function getHcbAccountKey() {
    if (accountKeyPromise) return accountKeyPromise;

    accountKeyPromise = (async () => {
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
    })();

    return accountKeyPromise;
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

const UPSCALE_TARGET = {
    width: 1800,
    height: 1100,
    quality: 0.94,
};

const DEFAULT_ACCOUNT_SETTINGS = {
    theme: DEFAULT_THEME,
    cardThemes: {},
    orgThemes: {},
    presets: {},
    editor: {},
    bannerSync: 'both',
    randomizer: {
        enabled: false,
        mode: 'once',
        seed: '',
    },
    backups: [],
};

const BUILT_IN_THEMES = [
    'glass',
    'neon',
    'retro',
    'gradient',
    'holo',
    'minimal',
    'minecraft',
    'animated-gradient',
];

const getOrgKeyFromUrl = (url = '') => {
    try {
        const { pathname } = new URL(url);
        const parts = pathname.split('/').filter(Boolean);

        if (
            parts.length >= 1 &&
            !['my', 'stripe_cards', 'grants'].includes(parts[0])
        ) {
            return parts[0];
        }
    } catch {}
    return null;
};

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const pickRandomTheme = () => {
    return BUILT_IN_THEMES[Math.floor(Math.random() * BUILT_IN_THEMES.length)];
};

const normalizeAccountSettings = (current = {}) => ({
    ...DEFAULT_ACCOUNT_SETTINGS,
    ...current,
    theme: current.theme || current.global || DEFAULT_THEME,
    cardThemes: current.cardThemes || current.cards || {},
    orgThemes: current.orgThemes || current.orgs || {},
    presets: current.presets || {},
    editor: current.editor || {},
    bannerSync: current.bannerSync || 'both',
    randomizer: {
        ...DEFAULT_ACCOUNT_SETTINGS.randomizer,
        ...(current.randomizer || {}),
    },
    backups: current.backups || [],
});

const getAccountSettings = async () => {
    const accountKey = await getHcbAccountKey();
    const syncData = await chrome.storage.sync.get(['accountThemes']);
    const accountThemes = syncData.accountThemes || {};
    const current = accountThemes[accountKey] || {};

    return normalizeAccountSettings(current);
};

const createAutoBackupSnapshot = (settings) => {
    return {
        createdAt: new Date().toISOString(),
        theme: settings.theme,
        cardThemes: settings.cardThemes,
        orgThemes: settings.orgThemes,
        presets: settings.presets,
        editor: settings.editor,
        bannerSync: settings.bannerSync,
        randomizer: settings.randomizer,
    };
};

const saveLocalBackup = async (accountKey, settings) => {
    const data = await chrome.storage.local.get(['accountBackups']);
    const accountBackups = data.accountBackups || {};
    const backups = accountBackups[accountKey] || [];

    accountBackups[accountKey] = [
        createAutoBackupSnapshot(settings),
        ...backups,
    ].slice(0, 5);

    await chrome.storage.local.set({ accountBackups });
};

const saveAccountSettings = async (settings, options = { backup: true }) => {
    const accountKey = await getHcbAccountKey();
    const syncData = await chrome.storage.sync.get(['accountThemes']);
    const accountThemes = syncData.accountThemes || {};
    const normalized = normalizeAccountSettings(settings);
    const { backups, ...nextSettings } = normalized;

    if (options.backup) {
        await saveLocalBackup(accountKey, normalized);
    }

    accountThemes[accountKey] = nextSettings;
    currentTheme = nextSettings.theme || DEFAULT_THEME;
    cardThemes = nextSettings.cardThemes || {};

    await chrome.storage.sync.set({ accountThemes });
};

const loadImageElement = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image for upscaling.'));
    img.src = src;
});

const upscaleImageDataUrl = async (imageDataUrl, options = UPSCALE_TARGET) => {
    const img = await loadImageElement(imageDataUrl);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = options.width;
    canvas.height = options.height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const sourceRatio = img.width / img.height;
    const targetRatio = canvas.width / canvas.height;

    let drawWidth;
    let drawHeight;
    let drawX;
    let drawY;

    if (sourceRatio > targetRatio) {
        drawHeight = canvas.height;
        drawWidth = drawHeight * sourceRatio;
        drawX = (canvas.width - drawWidth) / 2;
        drawY = 0;
    } else {
        drawWidth = canvas.width;
        drawHeight = drawWidth / sourceRatio;
        drawX = 0;
        drawY = (canvas.height - drawHeight) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    return canvas.toDataURL('image/jpeg', options.quality);
};

const themeName = (theme) => {
    if (theme === 'off') return 'Off';
    if (theme === 'animated-gradient') return 'Animated';
    if (theme === 'custom-editor') return 'Custom';
    return theme.charAt(0).toUpperCase() + theme.slice(1);
};

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

const renderPresetOptions = (presets = {}, selectedName = '') => {
    const select = document.getElementById('presetSelect');
    if (!select) return;

    const entries = Object.keys(presets).sort((a, b) => a.localeCompare(b));
    select.innerHTML = '';

    if (!entries.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No presets saved';
        select.appendChild(option);
        return;
    }

    entries.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        option.selected = name === selectedName;
        select.appendChild(option);
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

const refreshActiveTab = notifyActiveTab;

const normalizeImageUrl = (value) => {
    const raw = value.trim();
    if (!raw) throw new Error('Missing Image URL');

    const url = new URL(raw);

    if (!['https:', 'http:', 'data:'].includes(url.protocol)) {
        throw new Error('Unsupported image URL');
    }

    return url.href;
};

const loadImageUrl = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = reject;
    img.src = url;
});

const saveTheme = async (theme) => {
    const settings = await getAccountSettings();

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

    await saveAccountSettings(settings);

    setActiveCard(theme);
    updateStatus(activeScope === 'card'
        ? `This card: ${themeName(theme)}`
        : `Global: ${themeName(theme)}`,
        theme === 'off' ? '' : 'success');
    await notifyActiveTab();
};

const savePreset = async (name) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
        updateStatus('Enter a preset name first', 'error');
        return;
    }

    const settings = await getAccountSettings();
    settings.presets = { ...settings.presets };
    settings.presets[trimmedName] = {
        theme: getScopedTheme(),
        editor: settings.editor || {},
        bannerSync: settings.bannerSync || 'both',
        createdAt: new Date().toISOString(),
    };

    await saveAccountSettings(settings);
    renderPresetOptions(settings.presets, trimmedName);
    updateStatus('Preset saved', 'success');
};

const applyPreset = async (name) => {
    const settings = await getAccountSettings();
    const preset = settings.presets[name];

    if (!preset) {
        updateStatus('Preset not found', 'error');
        return;
    }

    settings.theme = preset.theme || settings.theme;
    settings.editor = preset.editor || {};
    settings.bannerSync = preset.bannerSync || 'both';

    await saveAccountSettings(settings);
    await refreshActiveTab();
    setActiveScope(activeScope);

    updateStatus('Preset applied', 'success');
};

const saveCurrentThemeForOrg = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const orgKey = getOrgKeyFromUrl(tabs[0]?.url);

    if (!orgKey) {
        updateStatus('No organization found on this page', 'error');
        return;
    }

    const settings = await getAccountSettings();

    settings.orgThemes = { ...settings.orgThemes };
    settings.orgThemes[orgKey] = {
        theme: getScopedTheme(),
        updatedAt: new Date().toISOString(),
    };

    await saveAccountSettings(settings);
    await refreshActiveTab();

    updateStatus(`Theme saved for ${orgKey}`, 'success');
};

const saveEditorTheme = async () => {
    const settings = await getAccountSettings();

    settings.editor = {
        background: document.getElementById('editorBgInput').value,
        text: document.getElementById('editorTextInput').value,
        glow: Number(document.getElementById('editorGlowInput').value),
    };

    settings.theme = 'custom-editor';

    await saveAccountSettings(settings);
    await refreshActiveTab();
    setActiveScope('global');

    updateStatus('Custom theme saved', 'success');
};

const saveBannerSync = async () => {
    const settings = await getAccountSettings();

    settings.bannerSync = document.getElementById('bannerSyncSelect').value;

    await saveAccountSettings(settings);
    await refreshActiveTab();
    updateStatus('Banner sync updated', 'success');
};

const encodeThemeCode = (themeData) => {
    return btoa(unescape(encodeURIComponent(JSON.stringify(themeData))));
};

const decodeThemeCode = (code) => {
    return JSON.parse(decodeURIComponent(escape(atob(code))));
};

const copyThemeCode = async () => {
    const settings = await getAccountSettings();

    const themeCode = encodeThemeCode({
        version: 1,
        theme: settings.theme,
        editor: settings.editor,
        bannerSync: settings.bannerSync,
    });

    await navigator.clipboard.writeText(themeCode);

    updateStatus('Theme code copied', 'success');
};

const importThemeCode = async () => {
    const input = document.getElementById('themeCodeInput');
    const imported = decodeThemeCode(input.value.trim());

    const settings = await getAccountSettings();

    settings.theme = imported.theme || settings.theme;
    settings.editor = imported.editor || {};
    settings.bannerSync = imported.bannerSync || 'both';

    await saveAccountSettings(settings);
    await refreshActiveTab();
    setActiveScope('global');

    updateStatus('Theme code imported', 'success');
};

const resetCurrentOrg = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const orgKey = getOrgKeyFromUrl(tabs[0]?.url);

    const settings = await getAccountSettings();

    if (orgKey) {
        settings.orgThemes = { ...settings.orgThemes };
        delete settings.orgThemes[orgKey];
    }

    await saveAccountSettings(settings);
    await refreshActiveTab();

    updateStatus('Org reset', 'success');
};

const resetImages = async () => {
    const accountKey = await getHcbAccountKey();
    const localData = await chrome.storage.local.get(['customImages']);
    const customImages = localData.customImages || {};

    delete customImages[accountKey];

    await chrome.storage.local.set({ customImages });
    const backupData = await chrome.storage.local.get(['accountBackups']);
    const accountBackups = backupData.accountBackups || {};
    delete accountBackups[accountKey];
    await chrome.storage.local.set({ accountBackups });
    await refreshActiveTab();

    updateStatus('Images reset', 'success');
};

const resetEverything = async () => {
    const accountKey = await getHcbAccountKey();
    const syncData = await chrome.storage.sync.get(['accountThemes']);
    const accountThemes = syncData.accountThemes || {};

    delete accountThemes[accountKey];

    await chrome.storage.sync.set({ accountThemes });

    const localData = await chrome.storage.local.get(['customImages']);
    const customImages = localData.customImages || {};

    delete customImages[accountKey];

    await chrome.storage.local.set({ customImages });
    await refreshActiveTab();

    updateStatus('Everything reset', 'success');
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
const applyRandomTheme = async (mode = 'once') => {
    const settings = await getAccountSettings();

    const seed = mode === 'daily'
        ? getTodayKey()
        : `${Date.now()}-${Math.random()}`;

    settings.randomizer = {
        enabled: true,
        mode,
        seed,
    };
    settings.theme = pickRandomTheme();

    await saveAccountSettings(settings);
    await refreshActiveTab();
    setActiveScope('global');

    updateStatus(`Random ${themeName(settings.theme)} theme applied`, 'success');
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
    activeOrgKey = activeTab?.url ? getOrgKeyFromUrl(activeTab.url) : null;
    activeCardFingerprintKey = activeTab?.id ? await getCardFingerprintFromTab(activeTab.id) : null;

    const settings = await getAccountSettings();

    currentTheme = settings.theme || DEFAULT_THEME;
    cardThemes = settings.cardThemes || {};

    renderPresetOptions(settings.presets);

    const bannerSyncSelect = document.getElementById('bannerSyncSelect');
    if (bannerSyncSelect) bannerSyncSelect.value = settings.bannerSync || 'both';

    const editorBgInput = document.getElementById('editorBgInput');
    if (editorBgInput && settings.editor.background) editorBgInput.value = settings.editor.background;

    const editorTextInput = document.getElementById('editorTextInput');
    if (editorTextInput && settings.editor.text) editorTextInput.value = settings.editor.text;

    const editorGlowInput = document.getElementById('editorGlowInput');
    if (editorGlowInput && Number.isFinite(Number(settings.editor.glow))) {
        editorGlowInput.value = String(settings.editor.glow);
    }

    const orgButton = document.getElementById('saveOrgThemeBtn');
    if (orgButton) {
        orgButton.disabled = !activeOrgKey;
        orgButton.textContent = activeOrgKey ? `Use Theme for ${activeOrgKey}` : 'Use Theme for this Org';
    }

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

document.getElementById('applyImageUrlBtn')?.addEventListener('click', async()=>{
    const input = document.getElementById('imageUrlInput')
    if (!input) return;

    try {
        updateStatus('Applying Image..', '');

        const imageUrl = normalizeImageUrl(input.value);
        await loadImageUrl(imageUrl);
        await saveCustomImage(imageUrl);
        await saveTheme('custom');

        updateStatus(
            activeScope === 'card'
                ? 'Image URL on this card'
                : 'Image URL applied',
            'success'
        );
        input.value = '';
    } catch (err){
        console.error(err);
        updateStatus('Invalid Image URL', 'error');
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
            const upscaledImage = await upscaleImageDataUrl(imageData);
            await saveCustomImage(upscaledImage);
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

const runAdvancedAction = (action, errorMessage = 'Action failed') => {
    action().catch(err => {
        console.error(err);
        updateStatus(errorMessage, 'error');
    });
};

document.getElementById('savePresetBtn')?.addEventListener('click', () => {
    runAdvancedAction(() => savePreset(document.getElementById('presetNameInput').value), 'Could not save preset');
});

document.getElementById('applyPresetBtn')?.addEventListener('click', () => {
    runAdvancedAction(() => applyPreset(document.getElementById('presetSelect').value), 'Could not apply preset');
});

document.getElementById('randomThemeBtn')?.addEventListener('click' , ()=> {
    runAdvancedAction(() => applyRandomTheme('once'), 'Could not randomize theme');
});

document.getElementById('randomDailyBtn')?.addEventListener('click', () => {
    runAdvancedAction(() => applyRandomTheme('daily'), 'Could not randomize theme');
});

document.getElementById('saveOrgThemeBtn')?.addEventListener('click', () => {
    runAdvancedAction(saveCurrentThemeForOrg, 'Could not save org theme');
});
document.getElementById('saveEditorThemeBtn')?.addEventListener('click', () => {
    runAdvancedAction(saveEditorTheme, 'Could not save custom theme');
});
document.getElementById('bannerSyncSelect')?.addEventListener('change', () => {
    runAdvancedAction(saveBannerSync, 'Could not update banner sync');
});
document.getElementById('copyThemeCodeBtn')?.addEventListener('click', () => {
    runAdvancedAction(copyThemeCode, 'Could not copy theme code');
});
document.getElementById('importThemeCodeBtn')?.addEventListener('click', () => {
    runAdvancedAction(importThemeCode, 'Invalid theme code');
});

document.getElementById('resetCardBtn')?.addEventListener('click', () => {
    runAdvancedAction(resetCurrentCard, 'Could not reset card');
});
document.getElementById('resetOrgBtn')?.addEventListener('click', () => {
    runAdvancedAction(resetCurrentOrg, 'Could not reset org');
});
document.getElementById('resetImagesBtn')?.addEventListener('click', () => {
    runAdvancedAction(resetImages, 'Could not reset images');
});
document.getElementById('resetEverythingBtn')?.addEventListener('click', () => {
    runAdvancedAction(resetEverything, 'Could not reset everything');
});

initialize().catch(err => {
    console.error(err);
    updateStatus('Could not load settings', 'error');
});
