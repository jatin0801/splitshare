const addNameBtn = document.getElementById("addNameBtn");
const newNameInput = document.getElementById("newName");
const namesContainer = document.getElementById("namesContainer");
const extractBtn = document.getElementById("extractBtn");
const loadingArea = document.getElementById("loadingArea");
const itemsArea = document.getElementById("itemsArea");
const testSheetBtn = document.getElementById("testSheetBtn");
const sheetUrlInput = document.getElementById("sheetUrl");
const sheetStatus = document.getElementById("sheetStatus");
const exportBtn = document.getElementById("exportBtn");
const exportStatus = document.getElementById("exportStatus");

let people = []; // array of {name}
let items = [];  // array of {product_name, product_price, product_image_url, quantity...}
let rawOrderDetails = {};
let sheetOk = false;


function renderPeople() {
  namesContainer.innerHTML = "";
  people.forEach((p, idx) => {
    const chip = document.createElement("div");
    chip.className = "nameChip";
    chip.innerHTML = `<span>${p}</span>`;
    const btn = document.createElement("button");
    btn.textContent = "✕";
    btn.onclick = () => { people.splice(idx,1); renderPeople(); renderItems(); };
    chip.appendChild(btn);
    namesContainer.appendChild(chip);
  });
}

addNameBtn.onclick = () => {
  const v = newNameInput.value.trim();
  if (!v) return;
  people.push(v);
  newNameInput.value = "";
  renderPeople();
  renderItems();
};

testSheetBtn.onclick = async () => {
  const sheetUrl = sheetUrlInput.value.trim();
  if (!sheetUrl) { sheetStatus.textContent = "Enter sheet URL"; return; }
  sheetStatus.textContent = "Testing...";
  const resp = await new Promise(resolve => chrome.runtime.sendMessage({ type: "test-sheet", sheetUrl }, r => resolve(r)));
  if (resp?.ok) {
    sheetStatus.textContent = `Connected: ${resp.spreadsheet.title}`;
    sheetOk = true;
  } else {
    sheetStatus.textContent = `Error: ${resp?.error || JSON.stringify(resp)}`;
    sheetOk = false;
  }
};

extractBtn.onclick = async () => {
  loadingArea.innerHTML = "<div class='loading'>Extracting order — please wait...</div>";
  itemsArea.innerHTML = "";
  const resp = await new Promise(resolve => chrome.runtime.sendMessage({ type: "run-extract" }, r => resolve(r)));
  rawOrderDetails = resp
  loadingArea.innerHTML = "";
  if (resp?.error) {
    itemsArea.innerHTML = `<div class="loading">Extraction failed: ${resp.error}</div>`;
    return;
  }
  // try to normalize items
  items = (resp.items || []).map(i => ({
    product_name: i.product_name || i.name || i.title || "Unnamed item",
    product_price: parsePrice(i.product_price || i.unit_price || i.price || i.total || i.amount) || 0,
    quantity: i.quantity || 1,
    product_image_url: i.product_image_url || (i.image || ""),
    raw: i
  }));
  if (!items.length) {
    itemsArea.innerHTML = `<div class="loading">No items found. Inspect the AgentQL response in console (background) for details.</div>`;
    console.log("Raw AgentQL response:", resp.raw);
    return;
  }
  renderItems();
};

function parsePrice(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[^0-9.\-]+/g, "");
  if (!s) return 0;
  return parseFloat(s);
}

function renderItems() {
  itemsArea.innerHTML = "";
  items.forEach((it, idx) => {
    const row = document.createElement("div");
    row.className = "itemRow";
    const img = document.createElement("img");
    img.className = "itemImg";
    img.src = it.product_image_url || "";
    img.onerror = () => { img.src = ""; img.style.background = "#f5f5f5"; };
    const info = document.createElement("div");
    info.className = "itemInfo";
    info.innerHTML = `<div class="itemName">${it.product_name}</div><div class="itemPrice">$${(it.product_price||0).toFixed(2)} × ${it.quantity}</div>`;
    const multi = document.createElement("select");
    multi.className = "multiSelect";
    multi.multiple = true;
    // option for no selection: we treat as "none selected"
    people.forEach((p,i) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.text = p;
      multi.appendChild(opt);
    });
    // attach default empty selection
    multi.onchange = () => {
      // store selections
      const selected = Array.from(multi.selectedOptions).map(o => o.value);
      items[idx].selectedUsers = selected;
    };
    // default none selected -> will be split equally among all people
    items[idx].selectedUsers = [];
    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(multi);
    itemsArea.appendChild(row);
  });
}

// compute splits and prepare rows for sheet
function computeSplitsRows() {
  const orderDate = rawOrderDetails?.order_info?.order_date || "N/A";
  const rows = [[`**Order Date:**`, `**${orderDate}**`]]; 
  const header = ["**Item**", "**Total Price**", ...people.map(p => `**${p}**`)];
  rows.push(header);

  let grandTotal = 0;
  const personTotals = {};
  people.forEach(p => personTotals[p] = 0);

  items.forEach(it => {
    const total = (it.product_price || 0);
    grandTotal += total;
    let alloc = {};
    const sel = it.selectedUsers && it.selectedUsers.length ? it.selectedUsers : (people.length ? people : []);
    if (!sel.length && people.length === 0) {
      // no people -> just list item with price, no allocations
      rows.push([it.product_name, total.toFixed(2)]);
      return;
    }
    // If only 1 selected user -> that user pays all
    if (sel.length === 1) {
      people.forEach(p => alloc[p] = p === sel[0] ? total : 0);
    } else {
      // multiple selected or none selected -> split equally among sel (or all people)
      const per = sel.length ? (total / sel.length) : 0;
      people.forEach(p => alloc[p] = sel.includes(p) ? per : 0);
    }
    // Update totals
    people.forEach(p => personTotals[p] += alloc[p]);

    const row = [it.product_name, total.toFixed(2)];
    people.forEach(p => row.push( alloc[p] ? Number(alloc[p].toFixed(2)) : 0 ));
    rows.push(row);
  });

  const taxAmount = rawOrderDetails?.order_info?.tax_amount || 0;
  if (taxAmount > 0 && people.length > 0) {
    const perPersonTax = taxAmount / people.length;
    const taxRow = ["**Tax**", `**${taxAmount.toFixed(2)}**`];
    people.forEach(p => {
      personTotals[p] += perPersonTax;
      taxRow.push(`**${perPersonTax.toFixed(2)}**`);
    });
    rows.push(taxRow);
  }

  const totalRow = ["**Total**", `**${(grandTotal + taxAmount).toFixed(2)}**`];
  people.forEach(p => totalRow.push(`**${personTotals[p].toFixed(2)}**`));
  rows.push(totalRow);
  return rows;
}

exportBtn.onclick = async () => {
  if (!items || !items.length) { exportStatus.textContent = "No items to export"; return; }
  const sheetUrl = sheetUrlInput.value.trim();
  if (!sheetUrl) { exportStatus.textContent = "Enter a Google Sheet URL"; return; }
  exportStatus.textContent = "Preparing export...";
  console.log("computing split rows")
  const rows = await computeSplitsRows();
  console.log("COMPLETED computing split rows")
  // send to background to write sheet
  const resp = await new Promise(resolve => chrome.runtime.sendMessage({ type: "write-sheet", sheetUrl, sheetName: "Sheet1", rows }, r => resolve(r)));
  console.log("SHEET WRITTEN")
  if (resp?.ok) {
    exportStatus.textContent = `Exported (${resp.updates?.updatedRows || resp.updates?.updatedRange || "unknown"})`;
  } else {
    exportStatus.textContent = `Error: ${resp?.error || JSON.stringify(resp)}`;
  }
};
