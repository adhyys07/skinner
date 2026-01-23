const normalizeTheme = (raw) => raw?.endsWith('Btn') ? raw.slice(0, -3) : raw;

const updateStatus = (message, isError = false) => {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = isError ? '#ff4444' : '#4ade80';
    }
};

document.querySelectorAll("button").forEach(btn =>{
    btn.onclick = async()=>{
        const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
        if (!tab) {
            updateStatus('No active tab', true);
            return;
        }
        const site = new URL(tab.url).hostname;
        const theme = normalizeTheme(btn.dataset.theme);
        if (!theme) {
            updateStatus('Invalid theme', true);
            return;
        }

        updateStatus('Applying...');

        // Store globally (what injector reads) and per-site (legacy)
        chrome.storage.sync.set({ theme, [site]: theme });

        // Apply theme in the active tab and reload
        chrome.scripting.executeScript({
            target:{tabId:tab.id},
            func:(themeName) => {
                const linkId = 'card-skinner-theme';
                let link = document.getElementById(linkId);
                if (!link) {
                    link = document.createElement('link');
                    link.id = linkId;
                    link.rel = 'stylesheet';
                    document.head.appendChild(link);
                }
                link.href = chrome.runtime.getURL(`themes/${themeName}.css`);
                // Reload to ensure theme is fully applied
                location.reload();
            },
            args:[theme],
        }).then(() => {
            updateStatus(`Active: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
        }).catch(err => {
            updateStatus('Failed to apply', true);
            console.error(err);
        });
    };
});

document.getElementById('imageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    updateStatus('Uploading...');

    const reader = new FileReader();
    reader.onload = (event) => {
        const imageData = event.target.result;

        // Use chrome.storage.local instead of sync for larger storage
        chrome.storage.local.set({ customImage: imageData }, () => {
            if (chrome.runtime.lastError) {
                updateStatus('Upload failed', true);
                console.error(chrome.runtime.lastError);
                return;
            }
            
            // Set theme to "custom" so glass theme doesn't interfere
            chrome.storage.sync.set({ theme: 'custom' }, () => {
                updateStatus('Image applied!');

                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        chrome.tabs.reload(tabs[0].id);
                    }
                });
            });
        });
    };
    
    reader.onerror = () => {
        updateStatus('Failed to read image', true);
    };
    
    reader.readAsDataURL(file);
});


const turnOffOverlays = async () => {
    updateStatus('Turning off...');
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab) {
        updateStatus('No active tab', true);
        return;
    }
    const site = new URL(tab.url).hostname;
    chrome.storage.sync.set({[site]: 'off', theme: 'off'});
    chrome.scripting.executeScript({
        target:{tabId:tab.id},
        func: () => {
            const cardSkinner = document.querySelector('.card-skinner');
            if (cardSkinner) {
                cardSkinner.classList.add('overlay-off');
            }
            location.reload();
        }
    }).then(() => {
        updateStatus('Overlays off');
    }).catch(err => {
        updateStatus('Failed', true);
        console.error(err);
    });
};

// Add event listener for the new button
const offButton = document.querySelector('button[data-theme="off"], button[data-theme="offBtn"]');
if (offButton) {
    offButton.onclick = turnOffOverlays;
}

// Load and display current theme on popup open
chrome.storage.sync.get(['theme'], (data) => {
    const current = data?.theme || 'glass';
    if (current === 'off') {
        updateStatus('Overlays off');
    } else {
        updateStatus(`Active: ${current.charAt(0).toUpperCase() + current.slice(1)}`);
    }
});