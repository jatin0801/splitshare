
# 🧾 Evenly Chrome Extension

A lightweight Chrome extension that automatically extracts order details from shopping sites (like Walmart or Amazon) using **AgentQL**, and then calculates item-wise and person-wise cost splits — just like Splitwise. Finally, it exports the result directly to **Google Sheets**.

---

## Features

* **Automatic Order Extraction** — Uses **AgentQL** to fetch structured order data (items, price, quantity, taxes, etc.) from webpages.
* **Smart Split Calculation** — Splits item costs equally or by selection among people.
* **Google Sheets Export** — Sends the final computed table (with totals and tax) to your connected Google Sheet.
* **Interactive UI** — Add or remove people, select who pays for what, and see totals update instantly.

---

## How It Works

1. **Navigate to an order page** (e.g., Walmart order summary).
2. **Click the extension icon** — it will use **AgentQL** to extract all relevant data.
3. **Review and adjust splits** (choose who paid for which item).
4. **Click “Export”** to send the computed split data to your Google Sheet.

---

## Tech Stack

| Component                 | Description                                                |
| ------------------------- | ---------------------------------------------------------- |
| **AgentQL**               | Extracts structured order details directly from webpages.  |
| **JavaScript**            | Core logic for computing item-wise and person-wise splits. |
| **Chrome Extension APIs** | Handles UI, background messaging, and sheet export.        |
| **Google Sheets API**     | Writes computed split data to your chosen Google Sheet.    |

---

## Export Example

| Item      | Total Price | Alice    | Bob      |
| --------- | ----------- | -------- | -------- |
| Milk      | 10.00       | 5.00     | 5.00     |
| Bread     | 6.00        | 3.00     | 3.00     |
| **Tax**   | **1.00**    | **0.50** | **0.50** |
| **Total** | **17.00**   | **8.50** | **8.50** |

---

## Setup Instructions

1. **Clone the repo**

   ```bash
   git clone https://github.com/yourusername/splitwise-extension.git
   cd splitwise-extension
   ```

2. **Add your Google API and AgentQL credentials**

   * Place your Google service account key and AgentQL API key in environment variables.
   * Enable the Google Sheets API in your GCP project.

3. **Load the extension in Chrome**

   * Go to `chrome://extensions/`
   * Enable **Developer Mode**
   * Click **Load unpacked** and select your project folder.

4. **Test the extraction**

   * Visit an order page (like Walmart).
   * Click the extension → it will show extracted order info.

5. **Export to Sheets**

   * Enter your Google Sheet URL.
   * Click **Export** → You’ll see “Preparing export…” and then “Exported”.

---

## Author

**Jatin Chhabria**
AI Engineer & Software Developer passionate about building tools that simplify everyday workflows.

