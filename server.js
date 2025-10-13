const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

const AGENTQL_API = "https://api.agentql.com/v1";
const API_KEY = process.env.AGENTQL_API_KEY;

app.post("/extract-order", async (req, res) => {
  try {
    const { html, url } = req.body;
    if (!html && !url) {
      return res.status(400).json({ error: "Must provide either html or url" });
    }

    const query = `
    {
      order_info {
        order_number,
        order_date,
        total_amount,
        tax_amount,
        shipping_cost,
        subtotal
      },
      items[] {
        product_name,
        product_price,
        quantity,
        unit_price,
        product_image_url,
        product_description,
        seller_name
      },
      billing_info {
        billing_address,
        payment_method,
        card_ending
      },
      shipping_info {
        shipping_address,
        delivery_date,
        tracking_number
      }
    }
    `;

    // Make request to /query-data endpoint
    const body = {
      query,
      html, 
      params: {
        wait_for: 0,
        is_scroll_to_bottom_enabled: false,
        mode: "fast",
        is_screenshot_enabled: false
      }
    };

    const response = await axios.post(
      `${AGENTQL_API}/query-data`,
      body,
      {
        headers: {
          "X-API-Key": API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    const data = response.data;
    return res.json(data);
  } catch (err) {
    console.error("AgentQL extraction failed:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// async function getSheetsClient() {
//   // Option A: from JSON string environment variable
//   console.log("getSheetsClient")
//   const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
//   if (!keyJson) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY_JSON env var (service account key JSON)");

//   const service_key = JSON.parse(keyJson);
//   const privateKey = service_key.private_key.replace(/\\n/g, "\n");
//     console.log("service_key", service_key)
//     console.log("Raw env length:", keyJson?.length);
// console.log("Parsed private key starts with:", service_key.private_key?.slice(0, 40));
// console.log(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON.includes("\\n")); // should print true


//   const jwtClient = new google.auth.JWT(
//     service_key.client_email,
//     null,
//     privateKey,
//     ["https://www.googleapis.com/auth/spreadsheets"]
//   );
//     await jwtClient.authorize();

//   return google.sheets({ version: "v4", auth: jwtClient });
// }

async function getSheetsClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  if (!keyJson) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY_JSON env var");

  const serviceKey = JSON.parse(keyJson);
  
  // Use fromJSON method
  const jwtClient = google.auth.fromJSON(serviceKey);
  jwtClient.scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  
  await jwtClient.authorize();
  
  return google.sheets({ version: 'v4', auth: jwtClient });
}

// Endpoint to test sheet connectivity (user supplies a sheets url or id)
app.post("/test-sheet", async (req, res) => {
  try {
    const { sheetUrlOrId } = req.body;
    if (!sheetUrlOrId) return res.status(400).json({ error: "Provide sheetUrlOrId" });

    // Extract sheetId from URL or accept id
    const match = sheetUrlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const sheetId = match ? match[1] : sheetUrlOrId;

    const sheets = await getSheetsClient();
    // Try reading first sheet meta
    const resp = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    // Return sheetTitle and sheets list as success
    return res.json({ ok: true, spreadsheet: { spreadsheetId: sheetId, title: resp.data.properties.title, sheets: resp.data.sheets.map(s => s.properties.title) }});
  } catch (err) {
    console.error("test-sheet failed:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// Endpoint to write rows to the sheet
app.post("/write-sheet", async (req, res) => {
  try {
    const { sheetUrlOrId, sheetName = "Sheet1", rows } = req.body;

    if (!sheetUrlOrId || !rows || !Array.isArray(rows)) return res.status(400).json({ error: "Provide sheetUrlOrId and rows array" });

    const match = sheetUrlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const sheetId = match ? match[1] : sheetUrlOrId;

    const sheets = await getSheetsClient();

    // Prepare values. Expect rows to be array of arrays matching header columns.
    // We'll append starting at A1 (append)
    const appendResp = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rows
      }
    });

    return res.json({ ok: true, updates: appendResp.data.updates });
  } catch (err) {
    console.error("write-sheet failed:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});

// {
//   "order_info": {
//     "order_number": "2000136-55663399",
//     "order_date": "Oct 09, 2025",
//     "total_amount": 62.7,
//     "tax_amount": 1.51,
//     "shipping_cost": 0,
//     "subtotal": 68.33
//   },
//   "items": [
//     {
//       "product_name": "CHIPS AHOY! Chunky Chocolate Chip Cookies, Party Size, 24.75 oz",
//       "product_price": 5.98,
//       "quantity": 1,
//       "unit_price": null,
//       "product_image_url": "https://i5.walmartimages.com/asr/31cc4421-ad8c-47ad-8556-211e55d13c95.7faebf819f43d8d2b799cf50f2949a59.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": "Multipack Quantity: 1",
//       "seller_name": null
//     },
//     {
//       "product_name": "Franz Honey Wheat Sandwich Bread Loaf, 22.5 oz",
//       "product_price": 2.48,
//       "quantity": 1,
//       "unit_price": null,
//       "product_image_url": "https://i5.walmartimages.com/asr/012c7965-4407-4baa-81b7-4ed70fe533da.2c6d3c46a66a374f3a0fde418ca964e9.png?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": null,
//       "seller_name": null
//     },
//     {
//       "product_name": "Fresh Red Seedless Grapes from California, Bag (2.25 lbs/Bag Est.)",
//       "product_price": 4.18,
//       "quantity": 1,
//       "unit_price": 1.74,
//       "product_image_url": "https://i5.walmartimages.com/seo/Fresh-Red-Seedless-Grapes-Bag-2-25-lbs-Bag-Est_ace8729f-1c79-402e-8e32-a55c8083e4de.8adffa6c612c7353af44b587e61cec04.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": null,
//       "seller_name": null
//     },
//     {
//       "product_name": "Fresh Banana, Each",
//       "product_price": 2.8,
//       "quantity": 10,
//       "unit_price": 0.54,
//       "product_image_url": "https://i5.walmartimages.com/asr/5939a6fa-a0d6-431c-88c6-b4f21608e4be.f7cd0cc487761d74c69b7731493c1581.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": null,
//       "seller_name": null
//     },
//     {
//       "product_name": "Fresh Roma Tomato, Each",
//       "product_price": 0.56,
//       "quantity": 3,
//       "unit_price": 0.92,
//       "product_image_url": "https://i5.walmartimages.com/seo/Fresh-Roma-Tomato-Each_ecef8a3e-ab96-445e-a16a-d639b40eb5fb.93fcc627f542f02488e5ee9d8e26f152.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": null,
//       "seller_name": null
//     },
//     {
//       "product_name": "Great Value Dry Roasted and Unsalted Peanuts, 16 oz, Jar",
//       "product_price": 2.58,
//       "quantity": 1,
//       "unit_price": 0.161,
//       "product_image_url": "https://i5.walmartimages.com/seo/Great-Value-Dry-Roasted-and-Unsalted-Peanuts-16-oz-Jar_1b80125f-3a54-4d09-8b4b-79c07d9eaa1a.692d39d4d7a6921b4c292c53fedb86f8.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": "Multipack Quantity: 1\n16.1¢/oz",
//       "seller_name": null
//     },
//     {
//       "product_name": "Great Value, 2% Reduced Fat Milk, Gallon, Refrigerated",
//       "product_price": 2.97,
//       "quantity": 1,
//       "unit_price": 0.023,
//       "product_image_url": "https://i5.walmartimages.com/seo/Great-Value-2-Reduced-Fat-Milk-Gallon-Refrigerated_22a6459a-13b6-4057-aeae-45e62c69e8f8.47f793426ff66fa6432c948d836704f0.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": "2.3¢/fl oz",
//       "seller_name": null
//     },
//     {
//       "product_name": "Great Value Electrolyte Vitamin Enhanced Strawberry Kiwi Drink Mix, 0.08 oz, 10 Count",
//       "product_price": 1.98,
//       "quantity": 1,
//       "unit_price": 2.48,
//       "product_image_url": "https://i5.walmartimages.com/seo/Great-Value-Electrolyte-Vitamin-Enhanced-Strawberry-Kiwi-Drink-Mix-0-08-oz-10-Count_720a15f3-c88d-430a-98c6-dd08570fcba6.8f69a96bce1455326e46256580977be9.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": "Flavor: Strawberry Kiwi\nCount: 10\n$2.48/oz",
//       "seller_name": null
//     },
//     {
//       "product_name": "bettergoods Honey Vanilla Whole Milk Greek Yogurt, 32 oz Tub",
//       "product_price": 3.93,
//       "quantity": 1,
//       "unit_price": 0.123,
//       "product_image_url": "https://i5.walmartimages.com/seo/bettergoods-Whole-Milk-Honey-Vanilla-Greek-Yogurt-32-oz_91f824d5-6d6c-48a4-a118-014872d38c0e.e3c281b856e9fc8127adc1eb13629403.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": "12.3¢/oz",
//       "seller_name": null
//     },
//     {
//       "product_name": "Great Value Kettle Cooked Spicy Jalapeno Potato Chips, 8 oz Bag",
//       "product_price": 1.97,
//       "quantity": 1,
//       "unit_price": 0.246,
//       "product_image_url": "https://i5.walmartimages.com/seo/Great-Value-Kettle-Cooked-Spicy-Jalapeno-Potato-Chips-8-oz-Bag_cb0f59e4-0a38-4662-803d-0eea1c70f4e2.044606770121bc5fb5e364f379bcf6ea.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": "24.6¢/oz",
//       "seller_name": null
//     },
//     {
//       "product_name": "Great Value Party Size Original Potato Chips 13oz bag",
//       "product_price": 1.97,
//       "quantity": 1,
//       "unit_price": 0.152,
//       "product_image_url": "https://i5.walmartimages.com/seo/Great-Value-Party-Size-Original-Potato-Chips-13oz-bag_fb14746e-087a-4f15-b854-d38f54a0868c.83ebe284fdb83d588592ab79ba49da88.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": "15.2¢/oz",
//       "seller_name": null
//     },
//     {
//       "product_name": "Great Value Pepper Jack Shredded Cheese, 8 oz Bag",
//       "product_price": 1.97,
//       "quantity": 1,
//       "unit_price": 0.246,
//       "product_image_url": "https://i5.walmartimages.com/seo/Great-Value-Shredded-Pepper-Jack-Cheese-8-oz_cbd4598e-1270-4ce7-bc6e-f2d69dde2cd9.1ff683647ddcbe2114b1d0c2fb9af01d.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": "24.6¢/oz",
//       "seller_name": null
//     },
//     {
//       "product_name": "Pen+Gear White Card Stock, 8.5\" x 11\", 67 lb, 100 Sheets",
//       "product_price": 4.97,
//       "quantity": 1,
//       "unit_price": 4.97,
//       "product_image_url": "https://i5.walmartimages.com/seo/Pen-Gear-White-Card-Stock-8-5-x-11-67-lb-100-Sheets_38f28faa-1f31-417a-9cee-dc3baac58c22.b02ce2e20e7f2e6275024c575a1580a0.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": "Count: 100\n$4.97/ea",
//       "seller_name": null
//     },
//     {
//       "product_name": "bettergoods Whole Milk Strawberries and Cream Greek Yogurt, 32 oz Tub",
//       "product_price": 3.93,
//       "quantity": 1,
//       "unit_price": 0.123,
//       "product_image_url": "https://i5.walmartimages.com/seo/bettergoods-Whole-Milk-Strawberries-and-Cream-Flavored-Greek-Yogurt-32-oz_50d03747-51ca-4fda-8e79-c7a566a03b1c.abdde1b81afa7df956c1d724657b7d21.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": "12.3¢/oz",
//       "seller_name": null
//     },
//     {
//       "product_name": "Great Value Tomato Basil Garlic Pasta Sauce, 24 oz",
//       "product_price": 1.67,
//       "quantity": 1,
//       "unit_price": 0.07,
//       "product_image_url": "https://i5.walmartimages.com/seo/Great-Value-Tomato-Basil-Garlic-Pasta-Sauce-24-oz_7db9f544-d9d8-41e8-87ae-a68fe9de2742_1.1e3e17f44e5caf425516fc3a40b4746f.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": "Multipack Quantity: 1\n7.0¢/oz",
//       "seller_name": null
//     },
//     {
//       "product_name": "Great Value Rotini, 16 oz",
//       "product_price": 0.74,
//       "quantity": 1,
//       "unit_price": 0.046,
//       "product_image_url": "https://i5.walmartimages.com/seo/Great-Value-Rotini-16-oz-Box-Shelf-Stable_d4f8e94c-a0f6-41de-babb-ef243202fea4.d9adf642f91fd9ae8b67935e2ab6b218.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": "Multipack Quantity: 1\n4.6¢/oz",
//       "seller_name": null
//     },
//     {
//       "product_name": "Fresh Red Onions, 3 lb, Bag",
//       "product_price": 0.74,
//       "quantity": 1,
//       "unit_price": 0.247,
//       "product_image_url": "https://i5.walmartimages.com/asr/0e801ba7-69e3-4095-805a-bb4be884599f.12efd02773242a17e1255371d30b07e6.png?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": null,
//       "seller_name": null
//     },
//     {
//       "product_name": "Fresh Yellow Onions, 3 lb Bag",
//       "product_price": 1.96,
//       "quantity": 1,
//       "unit_price": 0.041,
//       "product_image_url": "https://i5.walmartimages.com/asr/77a8ef80-e2cc-4062-a87a-4673cfaf10f2.768d6312632f7da7e1b5e8ce3d8c5391.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": "4.1¢/oz",
//       "seller_name": null
//     },
//     {
//       "product_name": "Freshness Guaranteed Sliced White Mushrooms, 8 oz",
//       "product_price": 3.94,
//       "quantity": 2,
//       "unit_price": 0.246,
//       "product_image_url": "https://i5.walmartimages.com/asr/be689fbf-6149-4d12-a67f-924c4e694053.d60a739dc5490fd18e68a8d63f173716.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": null,
//       "seller_name": null
//     },
//     {
//       "product_name": "FRE Chardonnay California White Wine, Alcohol-Removed, 750 ml Glass Bottle, 0% ABV",
//       "product_price": 9.87,
//       "quantity": 1,
//       "unit_price": 0.389,
//       "product_image_url": "https://i5.walmartimages.com/seo/FRE-Chardonnay-California-White-Wine-Alcohol-Removed-750-ml-Glass-Bottle-0-ABV_9709720c-7fcb-4fa8-aaf2-621a66066635.686cd768b63144a673858e1aa02ff17e.jpeg?odnHeight=208&odnWidth=208&odnBg=FFFFFF",
//       "product_description": "38.9¢/fl oz",
//       "seller_name": null
//     }
//   ],
//   "billing_info": {
//     "billing_address": "14616 NE 44TH St, Apt M10, Bellevue, WA 98007",
//     "payment_method": "Visa",
//     "card_ending": "6207"
//   },
//   "shipping_info": {
//     "shipping_address": "14616 NE 44TH St, Apt M10, Bellevue, WA 98007",
//     "delivery_date": "today at 8:06am",
//     "tracking_number": null
//   }
// }