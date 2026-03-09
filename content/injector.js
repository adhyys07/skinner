(() => {
  console.log("[Card Skinner] Loaded in:", location.href);

  const CARD_SELECTOR = ".stripe-card.virtual.mt1";
  const isMyCardsPage = () => /\/my\/cards\/?$/.test(location.pathname);
  const isStripeCardPage = () => /^\/stripe_cards\//.test(location.pathname);
  const isOrgCardsPage = () => /^\/[^/]+\/cards\/?$/.test(location.pathname) && !isMyCardsPage();

  let cardClassObserver = null;
  let scheduledInitTimer = null;
  let lastInitAt = 0;
  let lastObservedUrl = location.pathname + location.search + location.hash;
  let routeRecoveryTimer = null;
  let routeRecoveryAttempts = 0;
  const INIT_MIN_INTERVAL_MS = 120;
  let isSkinning = false;

  function normalizeText(value) {
    return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function resetCardTheme(card) {
    card.classList.remove('card-skinner');
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
    if (!card) return false;

    const classBlob = [
      card.className || '',
      card.parentElement?.className || '',
      card.closest('.stripe-card')?.className || ''
    ].join(' ').toLowerCase();

    const excludedByClass = /\b(canceled|cancelled|deactivated|canceled-right|cancelled-right)\b/.test(classBlob);
    const statusText = (card.querySelector('.stripe-card__status')?.textContent || '').trim().toLowerCase();
    const excludedByStatus = statusText.includes('canceled') || statusText.includes('cancelled') || statusText.includes('deactivated');

    return excludedByClass || excludedByStatus;
  }

  function shouldThemeCard(card) {
    return isMyCardsPage() || isStripeCardPage() || isOrgCardsPage();
  }

  function applyTheme(theme) {
    let link = document.getElementById("card-skinner-theme");
    if (theme === 'off') {
      if (link) link.remove();
      return;
    }
    if (!link) {
      link = document.createElement("link");
      link.id = "card-skinner-theme";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = chrome.runtime.getURL(`themes/${theme}.css`);
  }

  let currentTheme = "glass";

  function applyTextColor(card) {
    if (currentTheme !== "glass") return;

    const htmlElement = document.documentElement;
    const isDarkValue = htmlElement.getAttribute('data-dark');
    const textColor = isDarkValue === 'false' ? '#000000' : '#ffffff';

    console.log('[Card Skinner DEBUG] data-dark:', isDarkValue, 'text color:', textColor);

    card.querySelectorAll('.stripe-card__number, .stripe-card__name, span, p').forEach(el => {
      el.style.setProperty('color', textColor, 'important');
    });
  }

  function applyCustomImage() {
    try {
      // Use chrome.storage.local for image storage (larger quota)
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['customImage'], (data) => {
          const img = data.customImage;
          if (!img) return;

          const cards = document.querySelectorAll('.card-skinner');
          cards.forEach(card => {
            const isFrozen = card.classList.contains('frozen');
            const shouldApply = (currentTheme === 'custom' || isFrozen) && currentTheme !== 'off';
            if (!shouldApply) return;
            console.log('[Card Skinner] Applying custom image');
            // Apply image directly with !important to override theme CSS and official UI
            card.style.setProperty('background-image', `url('${img}')`, 'important');
            card.style.setProperty('background-size', 'cover', 'important');
            card.style.setProperty('background-position', 'center', 'important');
            card.style.setProperty('background-repeat', 'no-repeat', 'important');
          });
        });
      }
    } catch (err) {
      console.log('[Card Skinner] Could not load custom image:', err);
    }
  }

  // Observe class changes on the main card to re-apply when HCB toggles frozen state
  function watchCardClass() {
    if (cardClassObserver) {
      cardClassObserver.disconnect();
      cardClassObserver = null;
    }
    const card = document.querySelector(CARD_SELECTOR);
    if (!card) return;
    cardClassObserver = new MutationObserver(muts => {
      if (isSkinning) return;
      for (const m of muts) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          // Re-apply styling and image when the site changes card classes
          skinCards();
          applyCustomImage();
        }
      }
    });
    cardClassObserver.observe(card, { attributes: true, attributeFilter: ['class'] });
  }

  function hideOfficialFreezeUI() {
    if (currentTheme !== 'freeze') return;
    
    // Hide all elements around the card that contain freeze-related UI
    const card = document.querySelector(CARD_SELECTOR);
    if (!card) return;
    
    // Hide parent containers with freeze info/actions
    const parent = card.closest('div');
    if (parent) {
      // Hide siblings containing freeze status, buttons, etc.
      Array.from(parent.parentElement.querySelectorAll('div, section, aside')).forEach(el => {
        const text = el.textContent || '';
        if (text.includes('Frozen') || text.includes('Defrost') || text.includes('Get reimbursed') || 
            text.includes('Freeze') || text.includes('reimbursement') || text.includes('frozen')) {
          el.style.display = 'none';
        }
      });
    }
  }

  function skinCards() {
    if (isSkinning) return;
    isSkinning = true;
    try {
      // When theme is off, only reset cards we previously themed
      if (currentTheme === 'off') {
        document.querySelectorAll(`${CARD_SELECTOR}.card-skinner`).forEach(card => resetCardTheme(card));
        return;
      }

      document.querySelectorAll(CARD_SELECTOR).forEach(card => {
        if (!shouldThemeCard(card)) {
          resetCardTheme(card);
          return;
        }
        if (isExcludedCard(card)) {
          resetCardTheme(card);
          return;
        }
        if (!card.classList.contains("card-skinner")) {
          card.classList.add("card-skinner");
        }
        // When not using custom theme, clear any leftover inline background from custom image
        if (currentTheme !== 'custom') {
          card.style.removeProperty('background-image');
          card.style.removeProperty('background-size');
          card.style.removeProperty('background-position');
          card.style.removeProperty('background-repeat');
        }
        applyTextColor(card);
      });
      hideOfficialFreezeUI();
    } finally {
      isSkinning = false;
    }
  }

  function loadThemeAndSkin() {
    try {
      const canGet = chrome && chrome.storage && chrome.storage.sync && typeof chrome.storage.sync.get === 'function';
      if (canGet) {
        chrome.storage.sync.get(["theme"], data => {
          currentTheme = data?.theme || "glass";
          applyTheme(currentTheme);
          skinCards();
          applyCustomImage();
          watchCardClass();
        });
        return;
      }
    } catch (e) {
      console.warn('[Card Skinner] storage get failed, defaulting to glass', e);
    }
    currentTheme = "glass";
    applyTheme(currentTheme);
    skinCards();
    applyCustomImage();
    watchCardClass();
  }

  // Debounce function to prevent excessive calls
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Robust initialization with multiple strategies
  function initializeExtension() {
    lastInitAt = Date.now();
    loadThemeAndSkin();
  }

  function scheduleInitialize(delay = 0) {
    const now = Date.now();
    const wait = Math.max(delay, INIT_MIN_INTERVAL_MS - (now - lastInitAt));
    if (scheduledInitTimer) {
      clearTimeout(scheduledInitTimer);
    }
    scheduledInitTimer = setTimeout(() => {
      scheduledInitTimer = null;
      initializeExtension();
    }, Math.max(0, wait));
  }

  function scheduleInitializeBurst(delays = [0, 180, 650]) {
    delays.forEach((delay) => {
      setTimeout(() => {
        scheduleInitialize(0);
      }, delay);
    });
  }

  function isAnyCardsPage() {
    return isMyCardsPage() || isOrgCardsPage() || isStripeCardPage();
  }

  function startRouteRecovery() {
    if (routeRecoveryTimer) {
      clearInterval(routeRecoveryTimer);
      routeRecoveryTimer = null;
    }

    routeRecoveryAttempts = 0;
    routeRecoveryTimer = setInterval(() => {
      routeRecoveryAttempts += 1;
      scheduleInitialize(0);

      const relevantPage = isMyCardsPage() || isOrgCardsPage();
      const anyCards = Boolean(document.querySelector(CARD_SELECTOR));
      const themedCards = Boolean(document.querySelector(`${CARD_SELECTOR}.card-skinner`));
      const done = !relevantPage || (anyCards && themedCards) || routeRecoveryAttempts >= 16;
      if (done) {
        clearInterval(routeRecoveryTimer);
        routeRecoveryTimer = null;
      }
    }, 250);
  }

  // IMMEDIATE execution - don't wait for anything
  initializeExtension();

  // Strategy 1: Immediate execution if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleInitialize());
  } else {
    // DOM already ready, execute immediately
    scheduleInitialize();
  }

  // Strategy 2: Wait for full page load
  window.addEventListener('load', () => scheduleInitializeBurst([0, 120, 500]));

  // Strategy 3: Aggressive retry with very fast interval
  let retryCount = 0;
  const maxRetries = 50; // 5 seconds total
  const retryInterval = setInterval(() => {
    const card = document.querySelector(CARD_SELECTOR);
    if (card || retryCount >= maxRetries) {
      clearInterval(retryInterval);
      if (card) {
        scheduleInitializeBurst([0, 140]);
        startRouteRecovery();
      }
    }
    retryCount++;
  }, 100); // Check every 100ms

  // Watch for new card elements and URL changes
  new MutationObserver((mutations) => {
    if (isSkinning) return;
    const currentUrl = location.pathname + location.search + location.hash;
    if (currentUrl !== lastObservedUrl) {
      lastObservedUrl = currentUrl;
      scheduleInitializeBurst([0, 180, 700]);
      startRouteRecovery();
    }

    let cardAdded = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            // Check if the added node is a card or contains a card
            if (node.matches && node.matches(CARD_SELECTOR)) {
              cardAdded = true;
            } else if (node.querySelector && node.querySelector(CARD_SELECTOR)) {
              cardAdded = true;
            }
          }
        });
      }
    }
    
    if (cardAdded) {
      // Card was just added, apply immediately
      console.log('[Card Skinner] Card detected in DOM, applying theme...');
      scheduleInitialize(0);
    }
  }).observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Watch for data-dark attribute changes and re-apply text color
  new MutationObserver(() => {
    if (isSkinning) return;
    skinCards();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-dark']
  });

  // Strategy 5: Handle SPA navigation (for client-side routing)
  // Intercept pushState and replaceState to detect URL changes
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    lastObservedUrl = location.pathname + location.search + location.hash;
    scheduleInitializeBurst([20, 180, 700]);
    startRouteRecovery();
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    lastObservedUrl = location.pathname + location.search + location.hash;
    scheduleInitializeBurst([20, 180, 700]);
    startRouteRecovery();
  };

  // Also listen for popstate (back/forward buttons)
  window.addEventListener('popstate', () => {
    lastObservedUrl = location.pathname + location.search + location.hash;
    scheduleInitializeBurst([20, 180, 700]);
    startRouteRecovery();
  });

  // Listen for hashchange as well
  window.addEventListener('hashchange', () => {
    lastObservedUrl = location.pathname + location.search + location.hash;
    scheduleInitializeBurst([50, 220]);
    startRouteRecovery();
  });

  // Handle back/forward cache restores where normal load/navigation hooks may not fire.
  window.addEventListener('pageshow', () => {
    lastObservedUrl = location.pathname + location.search + location.hash;
    scheduleInitializeBurst([0, 160, 550]);
    startRouteRecovery();
  });

  // Focus can return after tab/app switch without strong DOM mutation signals.
  window.addEventListener('focus', () => {
    if (!isAnyCardsPage()) return;
    scheduleInitialize(40);
  });

  // Strategy 6: Re-apply when tab becomes visible (in case card loaded while tab was hidden)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      scheduleInitializeBurst([50, 300]);
      startRouteRecovery();
    }
  });

  // Lightweight self-heal: only touch cards pages and only when cards exist but none are themed.
  setInterval(() => {
    if (currentTheme === 'off') return;
    if (!isAnyCardsPage()) return;
    const hasCard = Boolean(document.querySelector(CARD_SELECTOR));
    if (!hasCard) return;
    const hasThemedCard = Boolean(document.querySelector(`${CARD_SELECTOR}.card-skinner`));
    if (!hasThemedCard) {
      scheduleInitializeBurst([0, 220]);
    }
  }, 1800);
})();
