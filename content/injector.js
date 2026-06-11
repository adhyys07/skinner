(() => {
  const CARD_SELECTOR = '.stripe-card.mt1';
  const THEMES = ['glass', 'neon', 'retro', 'gradient', 'holo', 'minimal', 'minecraft', 'freeze', 'custom'];
  const DEFAULT_THEME = 'glass';

  const isMyCardsPage = () => /\/my\/cards\/?$/.test(location.pathname);
  const isStripeCardPage = () => /^\/stripe_cards\//.test(location.pathname);
  const isOrgCardsPage = () => /^\/[^/]+\/cards\/?$/.test(location.pathname) && !isMyCardsPage();
  const isAnyCardsPage = () => isMyCardsPage() || isOrgCardsPage() || isStripeCardPage();

  let currentTheme = DEFAULT_THEME;
  let currentCardThemes = {};
  let customImage = null;
  let accountKeyPromise = null;
  let stylePromise = null;
  let settingsPromise = null;
  let scheduledApply = false;
  let isSkinning = false;
  let lastObservedUrl = location.pathname + location.search + location.hash;

  async function getHcbAccountKey() {
    if (accountKeyPromise) return accountKeyPromise;

    accountKeyPromise = fetch('/api/current_user', { credentials: 'include' })
      .then(response => response.ok ? response.json() : null)
      .then(user => String(user?.id || user?.email || user?.name || 'unknown-account'))
      .catch(() => 'unknown-account');

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
      style.textContent = cssParts.join('\n\n');
    });

    return stylePromise;
  }

  async function loadSettings() {
    if (settingsPromise) return settingsPromise;

    settingsPromise = Promise.all([
      getHcbAccountKey(),
      chrome.storage.sync.get(['accountThemes']),
      chrome.storage.local.get(['customImage']),
    ]).then(([accountKey, syncData, localData]) => {
      const accountThemes = syncData?.accountThemes || {};
      const settings = accountThemes[accountKey] || {};
      currentTheme = settings.theme || DEFAULT_THEME;
      currentCardThemes = settings.cardThemes || {};
      customImage = localData?.customImage || null;
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
    const link = card.closest('a[href*="/stripe_cards/"]');
    const href = link?.getAttribute('href');
    if (href) {
      try {
        const url = new URL(href, location.origin);
        const match = url.pathname.match(/^\/stripe_cards\/[^/]+/);
        if (match) return match[0];
      } catch {
        return null;
      }
    }

    const currentMatch = location.pathname.match(/^\/stripe_cards\/[^/]+/);
    return currentMatch ? currentMatch[0] : null;
  }

  function getCardTheme(card) {
    const cardKey = getCardKey(card);
    return (cardKey && currentCardThemes[cardKey]) || currentTheme;
  }

  function resetCardTheme(card) {
    card.classList.remove('card-skinner');
    card.removeAttribute('data-skinner-theme');
    card.style.removeProperty('background-image');
    card.style.removeProperty('background-size');
    card.style.removeProperty('background-position');
    card.style.removeProperty('background-repeat');
    card.style.removeProperty('background-color');
    card.style.removeProperty('opacity');
    card.style.removeProperty('filter');
    card.style.removeProperty('border');
    card.querySelectorAll('.stripe-card__number, .stripe-card__name, span, p').forEach(el => {
      el.style.removeProperty('color');
    });
  }

  function isExcludedCard(card) {
    if (!card) return true;

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

  function applyTextColor(card, theme) {
    if (theme !== 'glass') return;

    const isDarkValue = document.documentElement.getAttribute('data-dark');
    const textColor = isDarkValue === 'false' ? '#000000' : '#ffffff';
    card.querySelectorAll('.stripe-card__number, .stripe-card__name, span, p').forEach(el => {
      el.style.setProperty('color', textColor, 'important');
    });
  }

  function applyCustomImage(card, theme) {
    if (theme !== 'custom' || !customImage) return;

    card.style.setProperty('background-image', `url('${customImage}')`, 'important');
    card.style.setProperty('background-size', 'cover', 'important');
    card.style.setProperty('background-position', 'center', 'important');
    card.style.setProperty('background-repeat', 'no-repeat', 'important');
  }

  function skinCards() {
    if (isSkinning || !isAnyCardsPage()) return;
    isSkinning = true;

    try {
      document.querySelectorAll(CARD_SELECTOR).forEach(card => {
        const theme = getCardTheme(card);

        if (isExcludedCard(card) || theme === 'off') {
          resetCardTheme(card);
          return;
        }

        card.classList.add('card-skinner');
        card.dataset.skinnerTheme = theme;

        if (theme !== 'custom') {
          card.style.removeProperty('background-image');
          card.style.removeProperty('background-size');
          card.style.removeProperty('background-position');
          card.style.removeProperty('background-repeat');
        }

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

    if (area === 'local' && changes.customImage) {
      customImage = changes.customImage.newValue || null;
      scheduleApply();
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
