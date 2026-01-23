(() => {
  console.log("[Card Skinner] Loaded in:", location.href);

  // Only theme the MAIN homepage card preview
  const CARD_SELECTOR = ".stripe-card.active.virtual.mt1";

  function applyTheme(theme) {
    let link = document.getElementById("card-skinner-theme");
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
          if (data.customImage && currentTheme === 'custom') {
            console.log('[Card Skinner] Applying custom image');
            const cards = document.querySelectorAll('.card-skinner');
            cards.forEach(card => {
              // Apply image directly with !important to override theme CSS
              card.style.setProperty('background-image', `url('${data.customImage}')`, 'important');
              card.style.setProperty('background-size', 'cover', 'important');
              card.style.setProperty('background-position', 'center', 'important');
              card.style.setProperty('background-repeat', 'no-repeat', 'important');
            });
          }
        });
      }
    } catch (err) {
      console.log('[Card Skinner] Could not load custom image:', err);
    }
  }

  function skinCards() {
    document.querySelectorAll(CARD_SELECTOR).forEach(card => {
      if (!card.classList.contains("card-skinner")) {
        card.classList.add("card-skinner");
      }
      applyTextColor(card);
    });
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
  }

  loadThemeAndSkin();

  new MutationObserver(() => {
    skinCards();
    applyCustomImage();
  }).observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Watch for data-dark attribute changes and re-apply text color
  new MutationObserver(() => {
    skinCards();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-dark']
  });
})();
