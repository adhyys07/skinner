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

  function skinCards() {
    document.querySelectorAll(CARD_SELECTOR).forEach(card => {
      if (!card.classList.contains("card-skinner")) {
        card.classList.add("card-skinner");
      }
      
      // Debug: Check HTML element attributes
      const htmlElement = document.documentElement;
      const isDarkValue = htmlElement.getAttribute('data-dark');
      console.log('[Card Skinner DEBUG] HTML data-dark attribute:', isDarkValue);
      console.log('[Card Skinner DEBUG] HTML element:', htmlElement);
      console.log('[Card Skinner DEBUG] All HTML attributes:', Array.from(htmlElement.attributes).map(a => `${a.name}="${a.value}"`));
      
      // Auto-adjust text color based on data-dark attribute (only for glass theme)
      chrome.storage.sync.get(["theme"], data => {
        console.log('[Card Skinner DEBUG] Current theme from storage:', data.theme);
        
        if (data.theme === "glass" || !data.theme) {
          const textColor = isDarkValue === 'false' ? '#000000' : '#ffffff';
          
          console.log('[Card Skinner] Glass theme active - data-dark:', isDarkValue, 'text color:', textColor);
          
          // Apply text color directly to all text elements
          card.querySelectorAll('.stripe-card__number, .stripe-card__name, span, p').forEach(el => {
            el.style.setProperty('color', textColor, 'important');
            console.log('[Card Skinner DEBUG] Applied color to element:', el, 'color:', textColor);
          });
        } else {
          console.log('[Card Skinner] Non-glass theme, skipping text color adjustment');
        }
      });
    });
  }

  chrome.storage.sync.get(["theme"], data => {
    applyTheme(data.theme || "glass");
  });

  skinCards();

  new MutationObserver(skinCards).observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Watch for data-dark attribute changes
  new MutationObserver(() => {
    skinCards();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-dark']
  });
})();
