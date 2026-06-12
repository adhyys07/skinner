(() => {
  const CARD_SELECTOR = '.stripe-card.mt1:not(.deactivated):not(.canceled):not(.canceled-left):not(.canceled-right)';
  const RESET_SELECTOR = '.stripe-card.card-skinner, .stripe-card[data-skinner-theme], .stripe-card[data-skinner-original-style]';
  const THEMES = ['glass', 'neon', 'retro', 'gradient', 'holo', 'minimal', 'minecraft', 'freeze', 'custom'];
  const CARD_MENU_THEMES = ['glass', 'neon', 'retro', 'gradient', 'holo', 'minimal', 'minecraft', 'freeze'];
  const DEFAULT_THEME = 'glass';
  const ORIGINAL_STYLE_ATTR = 'data-skinner-original-style';
  const CARD_ACTION_CLASS = 'skinner-card-action';
  const CARD_MENU_ID = 'skinner-card-theme-menu';
  const GRANT_HEADER_CLASS = 'skinner-grant-header';

  const isHomePage = () => location.pathname === '/';
  const isMyCardsPage = () => /\/my\/cards\/?$/.test(location.pathname);
  const isStripeCardPage = () => /^\/stripe_cards\//.test(location.pathname);
  const isGrantPage = () => /^\/grants\//.test(location.pathname);
  const isOrgCardsPage = () => /^\/[^/]+\/cards\/?$/.test(location.pathname) && !isMyCardsPage();
  const isAnyCardsPage = () => isHomePage() || isMyCardsPage() || isOrgCardsPage() || isStripeCardPage() || isGrantPage();

  let currentTheme = DEFAULT_THEME;
  let currentCardThemes = {};
  let currentCustomImages = {};
  let currentUser = null;
  let customImage = null;
  let accountUserPromise = null;
  let accountKeyPromise = null;
  let stylePromise = null;
  let settingsPromise = null;
  let scheduledApply = false;
  let isSkinning = false;
  let lastObservedUrl = location.pathname + location.search + location.hash;

  function normalizeText(value) {
    return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  async function getHcbUser() {
    if (accountUserPromise) return accountUserPromise;

    accountUserPromise = fetch('/api/current_user', { credentials: 'include' })
      .then(response => response.ok ? response.json() : null)
      .catch(() => null);

    return accountUserPromise;
  }

  async function getHcbAccountKey() {
    if (accountKeyPromise) return accountKeyPromise;

    accountKeyPromise = getHcbUser()
      .then(user => String(user?.id || user?.email || user?.name || 'unknown-account'));

    return accountKeyPromise;
  }

  function rewriteThemeCss(css, theme) {
    return css.replace(/\.card-skinner\b/g, `.card-skinner[data-skinner-theme="${theme}"]`);
  }

  function ensureThemeStyles() {
    if (stylePromise) return stylePromise;

    stylePromise = Promise.all(
      THEMES.map(theme =>
        fetch(chrome.runtime.getURL(`themes/${theme}.css`))
          .then(response => response.ok ? response.text() : '')
          .then(css => rewriteThemeCss(css, theme))
          .catch(() => '')
      )
    ).then(cssParts => {
      let style = document.getElementById('card-skinner-theme');
      if (style && style.tagName !== 'STYLE') {
        style.remove();
        style = null;
      }
      if (!style) {
        style = document.createElement('style');
        style.id = 'card-skinner-theme';
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent = `${cssParts.join('\n\n')}

.canceled-card-wrapper .card-skinner::after,
.stripe-card.deactivated.card-skinner::after,
.stripe-card.canceled.card-skinner::after,
.stripe-card.canceled-left.card-skinner::after,
.stripe-card.canceled-right.card-skinner::after {
  content: none !important;
  display: none !important;
}

.canceled-card-wrapper {
  aspect-ratio: auto !important;
}

.canceled-card-wrapper .stripe-card.canceled-left {
  position: relative !important;
  clip-path: none !important;
  transform: none !important;
}

.canceled-card-wrapper .stripe-card.canceled-right {
  display: none !important;
}

.${CARD_ACTION_CLASS} {
  position: absolute !important;
  top: 8px !important;
  right: 8px !important;
  z-index: 30 !important;
  border: 1px solid rgba(255, 255, 255, 0.26) !important;
  border-radius: 999px !important;
  padding: 4px 8px !important;
  background: rgba(15, 17, 21, 0.62) !important;
  color: #ffffff !important;
  cursor: pointer !important;
  font: 700 11px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  letter-spacing: 0 !important;
  backdrop-filter: blur(8px) !important;
}

.${CARD_ACTION_CLASS}:hover {
  background: rgba(15, 17, 21, 0.84) !important;
}

#${CARD_MENU_ID} {
  position: fixed !important;
  z-index: 2147483647 !important;
  display: grid !important;
  grid-template-columns: repeat(2, minmax(88px, 1fr)) !important;
  gap: 6px !important;
  width: 196px !important;
  padding: 8px !important;
  border: 1px solid rgba(255, 255, 255, 0.14) !important;
  border-radius: 10px !important;
  background: rgba(15, 17, 21, 0.96) !important;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.38) !important;
  backdrop-filter: blur(12px) !important;
}

#${CARD_MENU_ID} button {
  min-height: 30px !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 8px !important;
  background: rgba(255, 255, 255, 0.08) !important;
  color: #ffffff !important;
  cursor: pointer !important;
  font: 700 11px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
}

#${CARD_MENU_ID} button:hover,
#${CARD_MENU_ID} button[aria-pressed="true"] {
  border-color: rgba(255, 255, 255, 0.44) !important;
  background: rgba(255, 255, 255, 0.18) !important;
}

.${GRANT_HEADER_CLASS}.card-skinner {
  position: relative !important;
  overflow: hidden !important;
}

.${GRANT_HEADER_CLASS}.card-skinner > * {
  position: relative !important;
  z-index: 4 !important;
}

.${GRANT_HEADER_CLASS}.card-skinner::before,
.${GRANT_HEADER_CLASS}.card-skinner::after {
  border-radius: inherit !important;
}

.${GRANT_HEADER_CLASS}.card-skinner[data-skinner-theme="glass"] {
  background-color: rgba(255, 255, 255, 0.06) !important;
  background-image: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.03)) !important;
  border-color: rgba(255, 255, 255, 0.24) !important;
}

.${GRANT_HEADER_CLASS}.card-skinner[data-skinner-theme="glass"]::after {
  background: rgba(255, 255, 255, 0.04) !important;
  backdrop-filter: blur(20px) saturate(180%) !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 32px rgba(31, 38, 135, 0.24) !important;
}

.${GRANT_HEADER_CLASS}.card-skinner[data-skinner-theme="minecraft"] {
  background-color: #5d8a3c !important;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(0,0,0,0.16) 31px, rgba(0,0,0,0.16) 32px),
    repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(0,0,0,0.16) 31px, rgba(0,0,0,0.16) 32px) !important;
  image-rendering: pixelated !important;
}

.${GRANT_HEADER_CLASS}.card-skinner[data-skinner-theme="minecraft"]::after {
  background:
    repeating-linear-gradient(0deg, transparent, transparent 7px, rgba(0,0,0,0.14) 7px, rgba(0,0,0,0.14) 8px),
    repeating-linear-gradient(90deg, transparent, transparent 7px, rgba(0,0,0,0.14) 7px, rgba(0,0,0,0.14) 8px) !important;
}

.${GRANT_HEADER_CLASS}.card-skinner[data-skinner-theme="minecraft"]::before {
  border: 3px solid #3b5929 !important;
  box-shadow: inset 2px 2px 0 #7ec850, inset -2px -2px 0 #4a6e30 !important;
}`;
    });

    return stylePromise;
  }

  async function loadSettings() {
    if (settingsPromise) return settingsPromise;

    settingsPromise = Promise.all([
      getHcbUser(),
      chrome.storage.sync.get(['accountThemes']),
      chrome.storage.local.get(['customImages']),
    ]).then(([user, syncData, localData]) => {
      currentUser = user;
      const accountKey = String(user?.id || user?.email || user?.name || 'unknown-account');
      const accountThemes = syncData?.accountThemes || {};
      const settings = accountThemes[accountKey] || {};
      currentTheme = settings.theme || DEFAULT_THEME;
      currentCardThemes = settings.cardThemes || {};
      currentCustomImages = localData?.customImages?.[accountKey] || {};
      customImage = currentCustomImages.global || null;
    }).finally(() => {
      settingsPromise = null;
    });

    return settingsPromise;
  }

  function scheduleApply() {
    if (scheduledApply) return;
    scheduledApply = true;

    requestAnimationFrame(() => {
      scheduledApply = false;
      skinCards();
    });
  }

  function refreshAndApply() {
    loadSettings()
      .then(() => ensureThemeStyles())
      .then(scheduleApply)
      .catch(() => {
        currentTheme = DEFAULT_THEME;
        currentCardThemes = {};
        scheduleApply();
      });
  }

  function getCardKey(card) {
    const link = card.closest('a[href*="/stripe_cards/"], a[href*="/grants/"]');
    const href = link?.getAttribute('href');
    if (href) {
      try {
        const url = new URL(href, location.origin);
        const match = url.pathname.match(/^\/(?:stripe_cards|grants)\/[^/]+/);
        if (match) return match[0];
      } catch {
        return null;
      }
    }

    const currentMatch = location.pathname.match(/^\/(?:stripe_cards|grants)\/[^/]+/);
    return currentMatch ? currentMatch[0] : null;
  }

  function getCardFingerprintKey(card) {
    const numberText = card.querySelector('.stripe-card__number')?.textContent || '';
    const last4Match = numberText.match(/\b(\d{4})\b/);
    return last4Match ? `last4:${last4Match[1]}` : null;
  }

  function getCardKeys(card) {
    return [getCardKey(card), getCardFingerprintKey(card)].filter(Boolean);
  }

  function getCardTheme(card) {
    const cardKeys = getCardKeys(card);
    const cardTheme = cardKeys.map(key => currentCardThemes[key]).find(Boolean);
    return cardTheme || currentTheme;
  }

  function rememberOriginalStyle(card) {
    if (card.hasAttribute(ORIGINAL_STYLE_ATTR)) return;
    card.setAttribute(ORIGINAL_STYLE_ATTR, card.getAttribute('style') || '');
  }

  function restoreOriginalStyle(card, { keepSnapshot = false } = {}) {
    if (!card.hasAttribute(ORIGINAL_STYLE_ATTR)) return;

    const originalStyle = card.getAttribute(ORIGINAL_STYLE_ATTR);
    if (originalStyle) {
      card.setAttribute('style', originalStyle);
    } else {
      card.removeAttribute('style');
    }

    if (!keepSnapshot) {
      card.removeAttribute(ORIGINAL_STYLE_ATTR);
    }
  }

  function clearTextOverrides(card) {
    card.querySelectorAll('.stripe-card__number, .stripe-card__name, span, p').forEach(el => {
      el.style.removeProperty('color');
    });
  }

  function resetCardTheme(card) {
    card.classList.remove('card-skinner');
    card.removeAttribute('data-skinner-theme');
    restoreOriginalStyle(card);
    clearTextOverrides(card);
  }

  function removeCardControls(card) {
    card.querySelector(`.${CARD_ACTION_CLASS}`)?.remove();
  }

  function getGrantHeader() {
    if (!isGrantPage()) return null;

    const manageControl = Array.from(document.querySelectorAll('a, button'))
      .find(el => normalizeText(el.textContent).includes('manage grant'));

    for (let el = manageControl?.parentElement; el && el !== document.body; el = el.parentElement) {
      const text = el.textContent || '';
      const rect = el.getBoundingClientRect();
      if (
        text.includes('Grant to') &&
        text.includes('Manage grant') &&
        rect.width > 280 &&
        rect.height > 120 &&
        rect.height < 420
      ) {
        return el;
      }
    }

    return Array.from(document.querySelectorAll('section, article, div'))
      .filter(el => {
        const text = el.textContent || '';
        const rect = el.getBoundingClientRect();
        return text.includes('Grant to') &&
          text.includes('Manage grant') &&
          rect.width > 280 &&
          rect.height > 120 &&
          rect.height < 420;
      })
      .sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return (aRect.width * aRect.height) - (bRect.width * bRect.height);
      })[0] || null;
  }

  function skinGrantHeader(card, theme) {
    const header = getGrantHeader();
    if (!header) return;

    if (theme === 'off') {
      header.classList.remove('card-skinner');
      header.classList.remove(GRANT_HEADER_CLASS);
      header.removeAttribute('data-skinner-theme');
      restoreOriginalStyle(header);
      clearTextOverrides(header);
      return;
    }

    rememberOriginalStyle(header);
    restoreOriginalStyle(header, { keepSnapshot: true });
    clearTextOverrides(header);
    header.classList.add('card-skinner');
    header.classList.add(GRANT_HEADER_CLASS);
    header.dataset.skinnerTheme = theme;
    applyGrantHeaderBackground(header, card, theme);
  }

  function resetGrantHeader() {
    const header = getGrantHeader();
    if (!header) return;

    header.classList.remove('card-skinner');
    header.classList.remove(GRANT_HEADER_CLASS);
    header.removeAttribute('data-skinner-theme');
    restoreOriginalStyle(header);
    clearTextOverrides(header);
  }


  function isExcludedCard(card) {
    if (!card) return true;
    if (card.closest('.canceled-card-wrapper')) return true;

    const classBlob = [
      card.className || '',
      card.parentElement?.className || '',
      card.closest('.stripe-card')?.className || '',
    ].join(' ').toLowerCase();

    const excludedByClass = /\b(canceled|cancelled|deactivated|canceled-right|cancelled-right)\b/.test(classBlob);
    const statusText = (card.querySelector('.stripe-card__status')?.textContent || '').trim().toLowerCase();
    const excludedByStatus = statusText.includes('canceled') || statusText.includes('cancelled') || statusText.includes('deactivated');

    return excludedByClass || excludedByStatus;
  }

  function getCurrentUserNames() {
    const names = [
      currentUser?.name,
      currentUser?.full_name,
      currentUser?.preferred_name,
    ].map(normalizeText).filter(Boolean);

    return Array.from(new Set([
      ...names,
      ...names.map(name => name.split(' ')[0]).filter(Boolean),
    ]));
  }

  function getCardOwnerName(card) {
    const nameSpans = Array.from(card.querySelectorAll('.stripe-card__name span'));
    const ownerSpan = nameSpans.find(span => !span.classList.contains('stripe-card__status'));
    return normalizeText(ownerSpan?.textContent);
  }

  function isCurrentUserCard(card) {
    if (isHomePage() || isMyCardsPage() || isStripeCardPage() || isGrantPage()) return true;

    const userNames = getCurrentUserNames();
    if (!userNames.length) return false;

    const ownerName = getCardOwnerName(card);
    return Boolean(ownerName && userNames.includes(ownerName));
  }

  function applyTextColor(card, theme) {
    if (theme !== 'glass') return;

    const isDarkValue = document.documentElement.getAttribute('data-dark');
    const textColor = isDarkValue === 'false' ? '#000000' : '#ffffff';
    card.querySelectorAll('.stripe-card__number, .stripe-card__name, span, p').forEach(el => {
      el.style.setProperty('color', textColor, 'important');
    });
  }

  function applyCustomImage(card, theme) {
    if (theme !== 'custom') return;

    const image = getCustomImageForCard(card);
    if (!image) return;

    card.style.setProperty('background-image', `url('${image}')`, 'important');
    card.style.setProperty('background-size', 'cover', 'important');
    card.style.setProperty('background-position', 'center', 'important');
    card.style.setProperty('background-repeat', 'no-repeat', 'important');
  }

  function getCustomImageForCard(card) {
    const cardKeys = getCardKeys(card);
    return cardKeys.map(key => currentCustomImages.cards?.[key]).find(Boolean) || customImage;
  }

  function applyGrantHeaderBackground(header, card, theme) {
    const themeBackgrounds = {
      glass: { color: 'rgba(255, 255, 255, 0.06)', image: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.03))' },
      neon: { color: 'transparent', image: 'linear-gradient(135deg, #00feba, #5b548a)' },
      retro: { color: '#1a1a2e', image: 'linear-gradient(135deg, #e94560 0%, #0f3460 50%, #16213e 100%)' },
      gradient: { color: 'transparent', image: 'linear-gradient(135deg, #667eea, #764ba2, #f093fb)' },
      holo: { color: 'transparent', image: 'linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff)' },
      minimal: { color: '#1a1d23', image: 'none' },
      minecraft: {
        color: '#5d8a3c',
        image: 'repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(0,0,0,0.16) 31px, rgba(0,0,0,0.16) 32px), repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(0,0,0,0.16) 31px, rgba(0,0,0,0.16) 32px)',
      },
      freeze: { color: 'rgba(100, 150, 200, 0.3)', image: 'linear-gradient(135deg, rgba(100,150,200,0.3), rgba(150,180,220,0.2))' },
    };

    if (theme === 'custom') {
      const image = getCustomImageForCard(card);
      if (!image) return;
      header.style.setProperty('background-image', `url('${image}')`, 'important');
      header.style.setProperty('background-size', 'cover', 'important');
      header.style.setProperty('background-position', 'center', 'important');
      header.style.setProperty('background-repeat', 'no-repeat', 'important');
      return;
    }

    const background = themeBackgrounds[theme];
    if (!background) return;

    header.style.setProperty('background-color', background.color, 'important');
    header.style.setProperty('background-image', background.image, 'important');
    header.style.setProperty('background-size', 'cover', 'important');
    header.style.setProperty('background-position', 'center', 'important');
    header.style.setProperty('background-repeat', 'no-repeat', 'important');
  }

  async function saveCardTheme(card, theme) {
    const cardKeys = getCardKeys(card);
    if (!cardKeys.length) return;

    const accountKey = await getHcbAccountKey();
    const data = await chrome.storage.sync.get(['accountThemes']);
    const accountThemes = data?.accountThemes || {};
    const settings = accountThemes[accountKey] || {
      theme: DEFAULT_THEME,
      cardThemes: {},
    };

    settings.cardThemes = { ...settings.cardThemes };
    if (theme === 'global') {
      cardKeys.forEach(key => {
        delete settings.cardThemes[key];
      });
    } else {
      cardKeys.forEach(key => {
        settings.cardThemes[key] = theme;
      });
    }

    accountThemes[accountKey] = settings;
    await chrome.storage.sync.set({ accountThemes });
    currentCardThemes = settings.cardThemes;
    closeCardThemeMenu();
    scheduleApply();
  }

  function closeCardThemeMenu() {
    document.getElementById(CARD_MENU_ID)?.remove();
  }

  function positionCardThemeMenu(menu, anchor) {
    const rect = anchor.getBoundingClientRect();
    const gap = 8;
    const left = Math.min(window.innerWidth - menu.offsetWidth - gap, Math.max(gap, rect.right - menu.offsetWidth));
    const top = Math.min(window.innerHeight - menu.offsetHeight - gap, Math.max(gap, rect.bottom + gap));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function openCardThemeMenu(card, anchor) {
    closeCardThemeMenu();

    const current = getCardTheme(card);
    const menu = document.createElement('div');
    menu.id = CARD_MENU_ID;
    menu.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
    });

    const options = [
      ['global', 'Use global'],
      ...CARD_MENU_THEMES.map(theme => [theme, theme.charAt(0).toUpperCase() + theme.slice(1)]),
      ['off', 'Off'],
    ];

    options.forEach(([theme, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.setAttribute('aria-pressed', theme === current ? 'true' : 'false');
      button.addEventListener('click', () => {
        saveCardTheme(card, theme).catch(err => console.warn('[Card Skinner] Could not save card theme', err));
      });
      menu.appendChild(button);
    });

    document.body.appendChild(menu);
    positionCardThemeMenu(menu, anchor);

    setTimeout(() => {
      document.addEventListener('click', closeCardThemeMenu, { once: true });
    }, 0);
  }

  function addCardThemeButton(card) {
    if (card.querySelector(`.${CARD_ACTION_CLASS}`)) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = CARD_ACTION_CLASS;
    button.textContent = 'Skin';
    button.title = 'Change this card theme';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openCardThemeMenu(card, button);
    });
    card.appendChild(button);
  }

  function skinCards() {
    if (isSkinning || !isAnyCardsPage()) return;
    isSkinning = true;

    try {
      document.querySelectorAll(RESET_SELECTOR).forEach(card => {
        if (isExcludedCard(card) || !isCurrentUserCard(card) || getCardTheme(card) === 'off') {
          resetCardTheme(card);
          if (isExcludedCard(card) || !isCurrentUserCard(card)) {
            removeCardControls(card);
          }
        }
      });

      document.querySelectorAll(CARD_SELECTOR).forEach(card => {
        const theme = getCardTheme(card);

        if (isExcludedCard(card) || !isCurrentUserCard(card) || theme === 'off') {
          resetCardTheme(card);
          if (isGrantPage()) resetGrantHeader();
          if (isExcludedCard(card) || !isCurrentUserCard(card)) {
            removeCardControls(card);
          } else {
            addCardThemeButton(card);
          }
          return;
        }

        rememberOriginalStyle(card);
        card.classList.add('card-skinner');
        card.dataset.skinnerTheme = theme;

        if (theme !== 'custom') {
          restoreOriginalStyle(card, { keepSnapshot: true });
        }

        clearTextOverrides(card);
        applyTextColor(card, theme);
        applyCustomImage(card, theme);
        addCardThemeButton(card);
        skinGrantHeader(card, theme);
      });
    } finally {
      isSkinning = false;
    }
  }

  function handlePossibleNavigation() {
    const currentUrl = location.pathname + location.search + location.hash;
    if (currentUrl === lastObservedUrl) return;

    lastObservedUrl = currentUrl;
    accountUserPromise = null;
    accountKeyPromise = null;
    refreshAndApply();
  }

  function observeDom() {
    if (!document.body) return;

    new MutationObserver(mutations => {
      if (isSkinning) return;
      handlePossibleNavigation();

      const hasCardChange = mutations.some(mutation => {
        if (mutation.type === 'attributes') return true;
        return Array.from(mutation.addedNodes).some(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return false;
          return node.matches?.(CARD_SELECTOR) || node.querySelector?.(CARD_SELECTOR);
        });
      });

      if (hasCardChange) scheduleApply();
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  function hookHistory(method) {
    const original = history[method];
    history[method] = function(...args) {
      const result = original.apply(this, args);
      handlePossibleNavigation();
      scheduleApply();
      return result;
    };
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.accountThemes) {
      settingsPromise = null;
      refreshAndApply();
    }

    if (area === 'local' && changes.customImages) {
      settingsPromise = null;
      refreshAndApply();
    }
  });

  window.addEventListener('card-skinner-storage-changed', refreshAndApply);
  window.addEventListener('resize', closeCardThemeMenu);
  window.addEventListener('scroll', closeCardThemeMenu, true);
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeCardThemeMenu();
  });
  window.addEventListener('popstate', refreshAndApply);
  window.addEventListener('hashchange', refreshAndApply);
  window.addEventListener('pageshow', refreshAndApply);
  document.addEventListener('turbo:load', refreshAndApply);
  document.addEventListener('turbo:frame-load', scheduleApply);

  new MutationObserver(scheduleApply).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-dark'],
  });

  hookHistory('pushState');
  hookHistory('replaceState');

  ensureThemeStyles();
  loadSettings();

  const start = () => {
    observeDom();
    refreshAndApply();
  };

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
