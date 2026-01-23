(() => {
  console.log("Card Skinner loaded");

  // ---- SITE MAP ----
  const SITE_MAP = {
    "hcb.hackclub.com": {
      cardSelector: ".stripe-card__overlay"
    }
  };

  const host = location.hostname;
  const site = SITE_MAP[host];

  if (!site) {
    console.log("Card Skinner: unsupported site");
    return; // ✅ now legal
  }

  // ---- APPLY THEME ----
  function applyTheme(themeName) {
    const existing = document.getElementById("card-skinner-theme");
    if (existing) existing.remove();

    const link = document.createElement("link");
    link.id = "card-skinner-theme";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL(`themes/${themeName}.css`);
    document.head.appendChild(link);
  }

  // ---- OBSERVER ----
  function observeCards(selector) {
    const applyClass = () => {
      document.querySelectorAll(selector).forEach(card => {
        card.classList.add("card-skinner");
      });
    };

    applyClass();

    const observer = new MutationObserver(applyClass);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ---- LOAD THEME ----
  chrome.storage.sync.get([host], (data) => {
    const theme = data[host] || "glass";
    applyTheme(theme);
  });

  observeCards(site.cardSelector);
})();
