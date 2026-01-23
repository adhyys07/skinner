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
})();
