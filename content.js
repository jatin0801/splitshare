chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("calllinnggggggggg content")
    if (msg.type === "getPageHTML") {
    const html = document.documentElement.outerHTML;
    const url = window.location.href;
    console.log("url", url)
    console.log("html", html)
    sendResponse({ html, url });
  }
  return true;
});
