(() => {
  console.log("[Card Skinner] Loaded in:", location.href);

  // Only theme the MAIN homepage card preview
  // Match both active and frozen states
  const CARD_SELECTOR = ".stripe-card.virtual.mt1";

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
    const card = document.querySelector(CARD_SELECTOR);
    if (!card) return;
    const obs = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          // Re-apply styling and image when the site changes card classes
          skinCards();
          applyCustomImage();
        }
      }
    });
    obs.observe(card, { attributes: true, attributeFilter: ['class'] });
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
    document.querySelectorAll(CARD_SELECTOR).forEach(card => {
      if (!card.classList.contains("card-skinner")) {
        card.classList.add("card-skinner");
      }
      applyTextColor(card);
    });
    hideOfficialFreezeUI();
  }
  function ensureControlPanel() {
    if (document.getElementById('card-skinner-panel')) return;

    const style = document.createElement('style');
    style.textContent = `
      #card-skinner-panel {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 99999;
        background: rgba(20,22,28,0.92);
        color: #e9ecf2;
        border: 1px solid #2a2f3a;
        border-radius: 10px;
        padding: 10px;
        width: 180px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.4);
        font-family: "Inter", system-ui, -apple-system, sans-serif;
      }
      #card-skinner-panel h4 { margin: 0 0 8px; font-size: 13px; font-weight: 700; }
      #card-skinner-panel button, #card-skinner-panel label.upload-btn {
        width: 100%; padding: 8px; margin-top: 6px;
        border: 1px solid #2a2f3a; border-radius: 8px;
        background: #171b23; color: inherit; cursor: pointer;
        font-weight: 600; text-align: center;
      }
      #card-skinner-panel button:hover, #card-skinner-panel label.upload-btn:hover { border-color: #5865f2; }
      #card-skinner-panel button:active, #card-skinner-panel label.upload-btn:active { transform: translateY(1px); }
      #card-skinner-status { display: block; margin-top: 8px; font-size: 12px; color: #9aa3b5; }
      #card-skinner-panel input[type="file"] { display: none; }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'card-skinner-panel';
    panel.innerHTML = `
      <h4>Card Skinner</h4>
      <button data-theme="glass">Glass Theme</button>
      <button data-theme="neon">Neon Theme</button>
      <button data-theme="off">Turn Off</button>
      <label class="upload-btn">
        📷 Upload Image
        <input type="file" id="card-skinner-image-upload" accept="image/*" />
      </label>
      <span id="card-skinner-status">Loading...</span>
    `;
    document.body.appendChild(panel);

    const setStatus = (msg, err = false) => {
      const el = document.getElementById('card-skinner-status');
      if (!el) return;
      el.textContent = msg;
      el.style.color = err ? '#ff5555' : '#50fa7b';
    };

    panel.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        setStatus(`Applying ${theme === 'off' ? 'none' : theme}...`);
        currentTheme = theme;
        
        // Apply immediately without reload
        applyTheme(currentTheme);
        skinCards();
        applyCustomImage();
        
        // Persist to storage asynchronously
        chrome.storage.sync.set({ theme }, () => {
          const displayName = theme === 'off' ? 'Off' : theme.charAt(0).toUpperCase() + theme.slice(1);
          setStatus(`${displayName} applied!`);
          
          // Reload page when turning off to restore original UI
          if (theme === 'off') {
            setTimeout(() => {
              window.location.href = window.location.href;
            }, 100);
          }
        });
      });
    });

    const fileInput = panel.querySelector('#card-skinner-image-upload');
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setStatus('Uploading...');
      const reader = new FileReader();
      reader.onload = (ev) => {
        const imageData = ev.target.result;
        chrome.storage.local.set({ customImage: imageData }, () => {
          if (chrome.runtime.lastError) {
            setStatus('Upload failed', true);
            return;
          }
          currentTheme = 'custom';
          applyTheme('custom');
          applyCustomImage();
          chrome.storage.sync.set({ theme: 'custom' }, () => {
            setStatus('Image applied!');
          }); 
        });
      };
      reader.onerror = () => setStatus('Read failed', true);
      reader.readAsDataURL(file);
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
    loadThemeAndSkin();
    
    // Ensure panel is created
    if (document.body) {
      ensureControlPanel();
    }
  }

  // IMMEDIATE execution - don't wait for anything
  initializeExtension();

  // Strategy 1: Immediate execution if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
  } else {
    // DOM already ready, execute immediately
    initializeExtension();
  }

  // Strategy 2: Wait for full page load
  window.addEventListener('load', initializeExtension);

  // Strategy 3: Aggressive retry with very fast interval
  let retryCount = 0;
  const maxRetries = 50; // 5 seconds total
  const retryInterval = setInterval(() => {
    const card = document.querySelector(CARD_SELECTOR);
    if (card || retryCount >= maxRetries) {
      clearInterval(retryInterval);
      if (card) {
        initializeExtension();
      }
    }
    retryCount++;
  }, 100); // Check every 100ms

  const debouncedUpdate = debounce(() => {
    ensureControlPanel();
    skinCards();
    applyCustomImage();
    watchCardClass();
  }, 50); // Reduced from 150ms to 50ms

  // More aggressive card detection - watch for new card elements specifically
  new MutationObserver((mutations) => {
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
      initializeExtension();
    } else {
      // Regular update with debouncing
      debouncedUpdate();
    }
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

  // Strategy 5: Handle SPA navigation (for client-side routing)
  // Intercept pushState and replaceState to detect URL changes
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    initializeExtension(); // Immediate
    setTimeout(initializeExtension, 50);
    setTimeout(initializeExtension, 200);
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    initializeExtension(); // Immediate
    setTimeout(initializeExtension, 50);
    setTimeout(initializeExtension, 200);
  };

  // Also listen for popstate (back/forward buttons)
  window.addEventListener('popstate', () => {
    initializeExtension(); // Immediate
    setTimeout(initializeExtension, 50);
    setTimeout(initializeExtension, 200);
  });

  // Listen for hashchange as well
  window.addEventListener('hashchange', () => {
    initializeExtension(); // Immediate
    setTimeout(initializeExtension, 50);
  });

  // Strategy 6: Re-apply when tab becomes visible (in case card loaded while tab was hidden)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      initializeExtension();
    }
  });

  // Strategy 7: Periodic check to ensure theme is applied (every 1 second)
  setInterval(() => {
    const card = document.querySelector(CARD_SELECTOR);
    if (card && !card.classList.contains('card-skinner')) {
      console.log('[Card Skinner] Periodic check: card found without theme, applying...');
      initializeExtension();
    }
  }, 1000); // Reduced from 2000ms to 1000ms
})();
