chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "getPageHTML") {
    const html = document.documentElement.outerHTML;
    const url = window.location.href;
    sendResponse({ html, url });
  }
  return true;
});
