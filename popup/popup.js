const host = new URL("https://"+location.hostname).hostname;

document.querySelectorAll("button").forEach(btn =>{
    btn.onclick = async()=>{
        const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
        const site = new URL(tab.url).hostname;
        chrome.storage.sync.set({[site]:btn.dataset.theme});
        chrome.scripting.executeScript({
            target:{tabId:tab.id},
            func:(theme) => {
                const link = document.getElementById('card-skinner-theme');
                if (link) link.href = chrome.runtime.getURL(`themes/${theme}.css`);
            },
            args:[btn.dataset.theme],
        });
    };
});

const turnOffOverlays = async () => {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    const site = new URL(tab.url).hostname;
    chrome.storage.sync.set({[site]: 'off'});
    chrome.scripting.executeScript({
        target:{tabId:tab.id},
        func: () => {
            const cardSkinner = document.querySelector('.card-skinner');
            if (cardSkinner) {
                cardSkinner.classList.add('overlay-off');
            }
            location.reload(); // Reload the website
        }
    });
};

// Add event listener for the new button
const offButton = document.querySelector('button[data-theme="off"]');
if (offButton) {
    offButton.onclick = turnOffOverlays;
}