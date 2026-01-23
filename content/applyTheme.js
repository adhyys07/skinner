export function applyTheme(themeName){
    const existing = document.getElementById('card-skinner-theme');
    if (existing) existing.remove();

    const link = document.createElement('link');
    link.id = 'card-skinner-theme';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL(`themes/${themeName}.css`);

    document.head.appendChild(link);
}