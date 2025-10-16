chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getPageHTML") {
    try {
      const html = document.documentElement.outerHTML;
      const url = window.location.href;
      
      // Additional metadata that might be useful for any site
      const title = document.title;
      const domain = window.location.hostname;

      sendResponse({ 
        html, 
        url, 
        title, 
        domain,
        success: true 
      });
    } catch (error) {
      sendResponse({ 
        error: error.message, 
        success: false 
      });
    }
    return true;
  }
});
