(() => {
  const CARD_SELECTOR = '.stripe-card.mt1:not(.deactivated):not(.canceled):not(.canceled-left):not(.canceled-right)';
  const RESET_SELECTOR = '.stripe-card.card-skinner, .stripe-card[data-skinner-theme], .stripe-card[data-skinner-original-style]';
  const THEMES = ['glass', 'neon', 'retro', 'gradient', 'holo', 'minimal', 'minecraft', 'freeze', 'custom'];
  const DEFAULT_THEME = 'glass';
  const ORIGINAL_STYLE_ATTR = 'data-skinner-original-style';

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

    const cardKeys = getCardKeys(card);
    const image = cardKeys.map(key => currentCustomImages.cards?.[key]).find(Boolean) || customImage;
    if (!image) return;

    card.style.setProperty('background-image', `url('${image}')`, 'important');
    card.style.setProperty('background-size', 'cover', 'important');
    card.style.setProperty('background-position', 'center', 'important');
    card.style.setProperty('background-repeat', 'no-repeat', 'important');
  }

  function skinCards() {
    if (isSkinning || !isAnyCardsPage()) return;
    isSkinning = true;

    try {
      document.querySelectorAll(RESET_SELECTOR).forEach(card => {
        if (isExcludedCard(card) || !isCurrentUserCard(card) || getCardTheme(card) === 'off') {
          resetCardTheme(card);
        }
      });

      document.querySelectorAll(CARD_SELECTOR).forEach(card => {
        const theme = getCardTheme(card);

        if (isExcludedCard(card) || !isCurrentUserCard(card) || theme === 'off') {
          resetCardTheme(card);
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
