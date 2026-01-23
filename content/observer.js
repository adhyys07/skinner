export function observeCards(selector, callback){
    const observer = new MutationObserver(() => {
        docyment.querySelectorAll(selector).forEach(callback);
});

observer.observe(document.body,{
    childList:true,
    subtree:true,
});
}