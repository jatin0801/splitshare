// const BACKEND = "http://localhost:3000";
const BACKEND = "https://splitshare-q58l.onrender.com";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "run-extract") {
    // ask content script for html
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) return sendResponse({ error: "No active tab" });

      chrome.tabs.sendMessage(tab.id, { type: "getPageHTML" }, async (resp) => {
        if (!resp) return sendResponse({ error: "Content script no response; ensure on Walmart page and extension allowed" });

        try {
          const fetchResp = await fetch(`${BACKEND}/extract-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ html: resp.html, url: resp.url })
          });
          const j = await fetchResp.json();
          const data =
          j?.data && typeof j.data === "object" && Object.keys(j.data).length
            ? j.data
            : j;
          // Normalize items: try to get j.data.items[] or similar depending on agentql response structure.
          // const items = (j?.data?.result?.items) || (j?.data?.items) || (j?.items) || extractItemsFallback(j);
          const items =
          data.result?.items ||
          data.items ||
          j.items ||
          extractItemsFallback(j);
          sendResponse({ ok: true, raw: j, items });
        } catch (e) {
          sendResponse({ error: e.message || e });
        }
      });
    });
    return true; // will sendResponse asynchronously
  }

  if (msg.type === "test-sheet") {
    const { sheetUrl } = msg;
    fetch(`${BACKEND}/test-sheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetUrlOrId: sheetUrl })
    })
      .then(r => r.json())
      .then(j => sendResponse(j))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (msg.type === "write-sheet") {
    fetch(`${BACKEND}/write-sheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetUrlOrId: msg.sheetUrl, sheetName: msg.sheetName, rows: msg.rows })
    })
    .then(r => r.json()).then(j => sendResponse(j)).catch(e => sendResponse({ error: e.message }));
    return true;
  }
});

// fallback to try find items inside unknown payload
function extractItemsFallback(j) {
  // naive attempt: search nested for items array
  function find(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (Array.isArray(obj) && obj.length && obj[0]?.product_name) return obj;
    for (const k of Object.keys(obj)) {
      const found = find(obj[k]);
      if (found) return found;
    }
    return null;
  }
  return find(j) || [];
}
