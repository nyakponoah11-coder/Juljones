require("dotenv").config();

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 10000;

const {
  WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_VERIFY_TOKEN,

  ABEKA_BRANCH_NUMBER,
  LAPAZ_BRANCH_NUMBER,
  GCTU_BRANCH_NUMBER,
  EAST_LEGON_BRANCH_NUMBER,
  UPSA_BRANCH_NUMBER,
  MADINA_BRANCH_NUMBER,

  STORE_NAME = "Juljones Food"
} = process.env;

const GRAPH_VERSION = process.env.GRAPH_VERSION || "v23.0";

const WA_URL =
  `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

/*--------------------------------------------------------------------------
BRANCHES
--------------------------------------------------------------------------*/
const BRANCHES = {
  "Abeka": { number: ABEKA_BRANCH_NUMBER },
  "Lapaz": { number: LAPAZ_BRANCH_NUMBER },
  "GCTU": { number: GCTU_BRANCH_NUMBER },
  "East Legon": { number: EAST_LEGON_BRANCH_NUMBER },
  "UPSA": { number: UPSA_BRANCH_NUMBER },
  "Madina": { number: MADINA_BRANCH_NUMBER }
};

/*--------------------------------------------------------------------------
FOOD PRICES
--------------------------------------------------------------------------*/
const RICE_PORTIONS = [
  { id: "rice_20", amount: 25, chicken: 1 },
  { id: "rice_25", amount: 30, chicken: 1 },
  { id: "rice_30", amount: 40, chicken: 1 },
  { id: "rice_40", amount: 45, chicken: 1 },
  { id: "rice_50", amount: 50, chicken: 2 }
];

/*--------------------------------------------------------------------------
 FUFU / BANKU / KOKONTE
--------------------------------------------------------------------------*/
const LOCAL_FOOD_AMOUNTS = [];
for (let amount = 5; amount <= 50; amount += 5) {
  LOCAL_FOOD_AMOUNTS.push(amount);
}

/*--------------------------------------------------------------------------
 PROTEINS
--------------------------------------------------------------------------*/
const PROTEINS = {
  chicken:   { name: "Chicken",        price: 15, emoji: "🍗" },
  intestine: { name: "Cow Intestines", price: 10, emoji: "🐄" },
  fish:      { name: "Fish",           price: 20, emoji: "🐟" },
  egg:       { name: "Egg",            price: 4,  emoji: "🥚" }
};

/*--------------------------------------------------------------------------
 SESSIONS AND ORDERS
--------------------------------------------------------------------------*/
const sessions = new Map();
const orders   = new Map();

/*--------------------------------------------------------------------------
 HELPERS
--------------------------------------------------------------------------*/
function normalizePhone(value) {
  let phone = String(value || "").replace(/\D/g, "");
  if (phone.startsWith("233")) return phone;
  if (phone.startsWith("0")) return "233" + phone.substring(1);
  return phone;
}

function money(amount) {
  return `₵${Number(amount).toFixed(2)}`;
}

function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, {
      step: "WELCOME",
      branch: null,
      food: null,
      ricePortion: null,
      foodAmount: null,
      proteins: [],
      fulfillment: null,
      address: null,
      order: null
    });
  }
  return sessions.get(phone);
}

function resetSession(phone) {
  sessions.set(phone, {
    step: "WELCOME",
    branch: null,
    food: null,
    ricePortion: null,
    foodAmount: null,
    proteins: [],
    fulfillment: null,
    address: null,
    order: null
  });
}

/*--------------------------------------------------------------------------
 WHATSAPP TEXT
--------------------------------------------------------------------------*/
async function sendWhatsAppText(to, body) {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body }
  };
  return axios.post(WA_URL, payload, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    }
  });
}

/*--------------------------------------------------------------------------
 WHATSAPP BUTTONS
--------------------------------------------------------------------------*/
async function sendButtons(to, body, buttons) {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map(button => ({
          type: "reply",
          reply: { id: button.id, title: button.title.substring(0, 20) }
        }))
      }
    }
  };
  return axios.post(WA_URL, payload, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    }
  });
}

/*--------------------------------------------------------------------------
 WHATSAPP LIST
--------------------------------------------------------------------------*/
async function sendInteractiveList(to, body, section, rows, buttonText = "Select") {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: buttonText.substring(0, 20),
        sections: [
          {
            title: section.substring(0, 24),
            rows: rows.slice(0, 10).map(row => ({
              id: row.id,
              title: row.title.substring(0, 24),
              description: row.description ? row.description.substring(0, 72) : undefined
            }))
          }
        ]
      }
    }
  };
  return axios.post(WA_URL, payload, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    }
  });
}

/*--------------------------------------------------------------------------
 BRANCH LIST
--------------------------------------------------------------------------*/
function branchRows() {
  return Object.keys(BRANCHES).map((branch, index) => ({
    id: `branch_${index}`,
    title: branch,
    description: "Choose this branch"
  }));
}

function getBranchFromId(id) {
  const branches = Object.keys(BRANCHES);
  const index = Number(String(id).replace("branch_", ""));
  return branches[index];
}

/*--------------------------------------------------------------------------
 FOOD LIST
--------------------------------------------------------------------------*/
function foodRows() {
  return [
    { id: "food_fried_rice", title: "Fried Rice",  description: "₵25 - ₵50" },
    { id: "food_jollof",     title: "Jollof Rice", description: "₵25 - ₵50" },
    { id: "food_waakye",     title: "Waakye",       description: "₵25 - ₵50" },
    { id: "food_fufu",       title: "Fufu",         description: "₵5 - ₵50"  },
    { id: "food_banku",      title: "Banku",        description: "₵5 - ₵50"  },
    { id: "food_kokonte",    title: "Kokonte",       description: "₵5 - ₵50"  },
    { id: "food_rice_ball",  title: "Rice Ball",    description: "₵5 - ₵50"  }
  ];
}

/*--------------------------------------------------------------------------
 RICE PORTIONS
--------------------------------------------------------------------------*/
function riceRows() {
  return RICE_PORTIONS.map(portion => ({
    id: portion.id,
    title: money(portion.amount),
    description: `${portion.chicken} chicken`
  }));
}

/*--------------------------------------------------------------------------
 LOCAL FOOD AMOUNTS
--------------------------------------------------------------------------*/
function localFoodAmountRows() {
  return LOCAL_FOOD_AMOUNTS.map(amount => ({
    id: `amount_${amount}`,
    title: money(amount),
    description: "Base food amount"
  }));
}

/*--------------------------------------------------------------------------
 PROTEIN SELECTION
--------------------------------------------------------------------------*/
function proteinRows() {
  return [
    { id: "protein_chicken",   title: "Chicken — ₵15",    description: "Add chicken"         },
    { id: "protein_intestine", title: "Intestines — ₵10", description: "Add cow intestines"  },
    { id: "protein_fish",      title: "Fish — ₵20",       description: "Add fish"            },
    { id: "protein_egg",       title: "Egg — ₵4",         description: "Add egg"             }
  ];
}

/*--------------------------------------------------------------------------
 CALCULATE TOTAL
--------------------------------------------------------------------------*/
function getBaseFoodPrice(session) {
  if (session.food === "Fried Rice" || session.food === "Jollof Rice" || session.food === "Waakye") {
    return session.ricePortion.amount;
  }
  return Number(session.foodAmount);
}

function getProteinTotal(session) {
  return session.proteins.reduce((total, protein) => {
    return total + PROTEINS[protein].price;
  }, 0);
}

function calculateTotal(session) {
  return getBaseFoodPrice(session) + getProteinTotal(session);
}

/*--------------------------------------------------------------------------
 PROTEIN SUMMARY
--------------------------------------------------------------------------*/
function proteinSummary(session) {
  if (!session.proteins.length) return "No extra protein";
  const counts = {};
  session.proteins.forEach(protein => {
    counts[protein] = (counts[protein] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([key, quantity]) => {
      const item = PROTEINS[key];
      return `${item.emoji} ${item.name} x${quantity} — ${money(item.price * quantity)}`;
    })
    .join("\n");
}

/*--------------------------------------------------------------------------
 ORDER ID
--------------------------------------------------------------------------*/
function generateOrderId() {
  const now = new Date();

  const date = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).replace(/\//g, "-");

  const time = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).replace(/:/g, "");

  const rand = Math.floor(Math.random() * 900 + 100);

  return `STN-${date}-${time}`;
}

/*--------------------------------------------------------------------------
 ORDER SUMMARY
--------------------------------------------------------------------------*/
function buildOrderSummary(session) {
  const basePrice = getBaseFoodPrice(session);
  return `🛍️ *${STORE_NAME.toUpperCase()} ORDER*

📍 Branch: ${session.branch}
🍽️ Food: ${session.food}
💰 Food amount: ${money(basePrice)}
${proteinSummary(session)}

━━━━━━━━━━━━━━

💵 *TOTAL: ${money(calculateTotal(session))}*
🚚 Method: ${session.fulfillment === "pickup" ? "Pick Up" : "Delivery — Pay on Delivery"}

${session.fulfillment === "delivery" ? `\n📍 Address:\n${session.address}` : ""}`;
}

/*--------------------------------------------------------------------------
 CUSTOMER CONFIRMATION
--------------------------------------------------------------------------*/
async function sendOrderConfirmation(to, session) {
  const total = calculateTotal(session);
  await sendWhatsAppText(to,
    `🧾 *PLEASE CONFIRM YOUR ORDER*\n\n${buildOrderSummary(session)}\n\n━━━━━━━━━━━━━━\n\nIs everything correct?`
  );
  return sendButtons(to,
    `Total: ${money(total)}\n\nWould you like to place this order?`,
    [
      { id: "confirm_order", title: "✅ Place Order" },
      { id: "cancel_order",  title: "❌ Cancel"      }
    ]
  );
}

/*--------------------------------------------------------------------------
 SEND ORDER TO BRANCH
--------------------------------------------------------------------------*/
async function sendOrderToBranch(order) {
  const branch = BRANCHES[order.branch];
  if (!branch || !branch.number) {
    console.error(`No WhatsApp number configured for ${order.branch}`);
    return false;
  }

  const message = `🔔 *NEW ORDER*

🆔 Order: ${order.id}
📍 Branch: ${order.branch}
📱 Customer: ${order.customerPhone}
🍽️ Food: ${order.food}
💰 Food: ${money(order.basePrice)}
${order.proteinSummary}

━━━━━━━━━━━━━━

💵 *TOTAL: ${money(order.total)}*
🚚 Method: ${order.fulfillment === "pickup" ? "PICK UP" : "DELIVERY — PAY ON DELIVERY"}

${order.fulfillment === "delivery" ? `\n📍 DELIVERY ADDRESS:\n${order.address}` : ""}

━━━━━━━━━━━━━━

Please start preparing this order.`;

  await sendWhatsAppText(normalizePhone(branch.number), message);

  await sendButtons(normalizePhone(branch.number),
    `Order ${order.id}\n\nWhat would you like to do?`,
    [
      { id: `staff_prepare_${order.id}`, title: "👨‍🍳 Preparing"   },
      { id: `staff_ready_${order.id}`,   title: "✅ Food Ready"   },
      { id: `staff_rider_${order.id}`,   title: "🚴 Rider On Way" }
    ]
  );

  return true;
}

/*--------------------------------------------------------------------------
 WELCOME MESSAGE
--------------------------------------------------------------------------*/
async function showWelcome(to) {
  const message = `👋 *WELCOME TO ${STORE_NAME.toUpperCase()}!* 🍛

We are happy to serve you.
Enjoy delicious local food from Juljones Food.

🍚 Fried Rice
🍚 Jollof Rice
🍚 Waakye
🍚 Rice Ball
🍲 Fufu
🍲 Banku
🍲 Kokonte

📍 First, choose the branch closest to you.`;

  await sendWhatsAppText(to, message);
  return sendInteractiveList(to,
    "📍 Which Juljones branch would you like to order from?",
    "Branches",
    branchRows()
  );
}

/*--------------------------------------------------------------------------
 HANDLE TEXT
--------------------------------------------------------------------------*/
async function handleText(from, text) {
  const input = String(text || "").trim();
  const lower = input.toLowerCase();

  if (["hi","hello","hey","start","menu"].includes(lower)) {
    resetSession(from);
    return showWelcome(from);
  }

  if (lower === "restart" || lower === "cancel") {
    resetSession(from);
    return sendWhatsAppText(from,
      "🔄 Your current order has been cancelled.\n\nSend *hi* to start a new order."
    );
  }

  const session = getSession(from);

  if (session.step === "ADDRESS") {
    session.address = input;
    session.step = "CONFIRMATION";
    return sendOrderConfirmation(from, session);
  }

  return sendWhatsAppText(from,
    "Please use the selection options above.\n\nSend *hi* if you want to start again."
  );
}

/*--------------------------------------------------------------------------
 HANDLE CUSTOMER INTERACTIVE
--------------------------------------------------------------------------*/
async function handleCustomerInteractive(from, message) {
  const reply = message.interactive;
  const id = reply?.list_reply?.id || reply?.button_reply?.id;
  if (!id) return;

  const session = getSession(from);

  /*-- BRANCH --*/
  if (id.startsWith("branch_")) {
    const branch = getBranchFromId(id);
    if (!branch) return;
    session.branch = branch;
    session.step = "FOOD";
    return sendInteractiveList(from,
      `📍 *${branch} BRANCH SELECTED*\n\nWhat would you like to eat?`,
      "Food Menu",
      foodRows()
    );
  }

  /*-- FOOD MENU --*/
  if (id.startsWith("food_")) {
    /*
     BUG 2 FIXED: food_rice_ball id now matches the foodRows() id.
     BUG 3 FIXED: food_waakye now routes to RICE_PORTION (priced like rice)
     instead of LOCAL_AMOUNT.
    */
    const foodMap = {
      food_fried_rice: "Fried Rice",
      food_jollof:     "Jollof Rice",
      food_waakye:     "Waakye",
      food_fufu:       "Fufu",
      food_banku:      "Banku",
      food_kokonte:    "Kokonte",
      food_rice_ball:  "Rice Ball"
    };

    const food = foodMap[id];
    if (!food) return;

    session.food = food;

    // Rice-style foods → show portions
    if (["Fried Rice", "Jollof Rice", "Waakye"].includes(food)) {
      session.step = "RICE_PORTION";
      return sendInteractiveList(from,
        `🍚 *${food}*\n\nChoose your portion:`,
        "Portions",
        riceRows()
      );
    }

    // Local foods → show amount
    session.step = "LOCAL_AMOUNT";
    return sendInteractiveList(from,
      `🍲 *${food}*\n\nChoose the amount of food you want.\n\nYou can select any amount from ₵5 to ₵50.`,
      "Food Amount",
      localFoodAmountRows()
    );
  }

  /*-- RICE PORTION --*/
  if (id.startsWith("rice_")) {
    const portion = RICE_PORTIONS.find(item => item.id === id);
    if (!portion) return;

    session.ricePortion = portion;
    session.proteins = [];
    for (let i = 0; i < portion.chicken; i++) {
      session.proteins.push("chicken");
    }
    session.step = "RICE_EXTRA";

    return sendButtons(from,
      `🍚 ${session.food} — ${money(portion.amount)}\n\n🍗 Includes ${portion.chicken} chicken.\n\nWould you like to add anything else?`,
      [
        { id: "add_protein", title: "➕ Add Protein" },
        { id: "no_extra",    title: "➡️ Continue"    }
      ]
    );
  }

  /*-- ADD PROTEIN --*/
  if (id === "add_protein") {
    session.step = "PROTEIN";
    return sendInteractiveList(from, "Choose a protein/add-on to add:", "Protein", proteinRows());
  }

  /*-- NO EXTRA --*/
  if (id === "no_extra") {
    session.step = "FULFILLMENT";
    return showFulfillmentOptions(from);
  }

  /*-- LOCAL FOOD AMOUNT --*/
  if (id.startsWith("amount_")) {
    const amount = Number(id.replace("amount_", ""));
    if (!LOCAL_FOOD_AMOUNTS.includes(amount)) return;

    session.foodAmount = amount;
    session.proteins = [];
    session.step = "PROTEIN";
    return sendInteractiveList(from,
      `${session.food}: ${money(amount)}\n\nNow choose your protein or add-on.`,
      "Protein",
      proteinRows()
    );
  }

  /*-- PROTEIN --*/
  if (id.startsWith("protein_")) {
    const proteinId = id.replace("protein_", "");
    if (!PROTEINS[proteinId]) return;

    session.proteins.push(proteinId);
    const item = PROTEINS[proteinId];

    await sendWhatsAppText(from,
      `✅ ${item.emoji} ${item.name} added — ${money(item.price)}\n\nCurrent total: ${money(calculateTotal(session))}`
    );

    return sendButtons(from,
      "Would you like to add another protein/add-on?",
      [
        { id: "add_more_protein", title: "➕ Add More" },
        { id: "done_protein",     title: "✅ Done"     }
      ]
    );
  }

  /*-- ADD MORE PROTEIN --*/
  if (id === "add_more_protein") {
    session.step = "PROTEIN";
    return sendInteractiveList(from, "Choose another protein/add-on:", "Protein", proteinRows());
  }

  /*-- DONE PROTEIN --*/
  if (id === "done_protein") {
    session.step = "FULFILLMENT";
    return showFulfillmentOptions(from);
  }

  /*-- PICKUP --*/
  if (id === "pickup") {
    session.fulfillment = "pickup";
    session.step = "CONFIRMATION";
    return sendOrderConfirmation(from, session);
  }

  /*-- DELIVERY --*/
  if (id === "delivery") {
    session.fulfillment = "delivery";
    session.step = "ADDRESS";
    return sendWhatsAppText(from,
      `🚚 *DELIVERY SELECTED*\n\n💵 Payment is *ON DELIVERY*.\n\nPlease send your full delivery address.\n\nFor example:\n\nArea:\nHouse number/name:\nNearest landmark:\n\nPlease send all the details in one message.`
    );
  }

  /*-- CONFIRM ORDER --*/
  if (id === "confirm_order") return placeCustomerOrder(from, session);

  /*-- CANCEL ORDER --*/
  if (id === "cancel_order") {
    resetSession(from);
    return sendWhatsAppText(from, "❌ Order cancelled.\n\nSend *hi* whenever you want to order again.");
  }
}

/*--------------------------------------------------------------------------
 FULFILLMENT OPTIONS
--------------------------------------------------------------------------*/
async function showFulfillmentOptions(to) {
  return sendInteractiveList(to,
    "🚚 How would you like to receive your food?",
    "Order Method",
    [
      { id: "pickup",   title: "Pick Up",  description: "Come to the selected branch" },
      { id: "delivery", title: "Delivery", description: "Pay the rider on delivery"   }
    ]
  );
}

/*--------------------------------------------------------------------------
 PLACE ORDER
--------------------------------------------------------------------------*/
async function placeCustomerOrder(from, session) {
  const order = {
    id:            generateOrderId(),
    customerPhone: from,
    branch:        session.branch,
    food:          session.food,
    basePrice:     getBaseFoodPrice(session),
    proteins:      [...session.proteins],
    proteinSummary: proteinSummary(session),
    total:         calculateTotal(session),
    fulfillment:   session.fulfillment,
    address:       session.address || null,
    status:        "NEW",
    createdAt:     new Date().toISOString()
  };

  orders.set(order.id, order);

  const branchSent = await sendOrderToBranch(order);
  if (!branchSent) {
    return sendWhatsAppText(from,
      `❌ We couldn't send your order to the ${order.branch} branch.\n\nPlease try again later or send *hi* to restart.`
    );
  }

  await sendWhatsAppText(from,
    `🎉 *ORDER PLACED SUCCESSFULLY!*

🆔 Order: ${order.id}
📍 Branch: ${order.branch}
🍽️ Food: ${order.food}
${order.proteinSummary}
💵 Total: ${money(order.total)}
🚚 Method: ${order.fulfillment === "pickup" ? "Pick Up" : "Delivery — Pay on Delivery"}

${order.fulfillment === "delivery" ? `\n📍 Address:\n${order.address}` : ""}

━━━━━━━━━━━━━━

Your order has been sent to the branch.

We will notify you when your food is ready. ❤️`
  );

  session.order = order;
  session.step = "ORDER_PLACED";
}

/*--------------------------------------------------------------------------
 STAFF ORDER STATUS
--------------------------------------------------------------------------*/
async function handleStaffAction(from, action, orderId) {
  const order = orders.get(orderId);
  if (!order) return sendWhatsAppText(from, `❌ Order ${orderId} was not found.`);

  if (action === "prepare") {
    order.status = "PREPARING";
    await sendWhatsAppText(order.customerPhone,
      `👨‍🍳 *YOUR ORDER IS BEING PREPARED*\n\n🆔 ${order.id}\n🍽️ ${order.food}\n📍 ${order.branch}\n\nYour food is now being prepared.\n\nWe'll notify you when it is ready. ❤️`
    );
    return sendWhatsAppText(from, `👨‍🍳 Order ${order.id} is now marked as *PREPARING*.`);
  }

  if (action === "ready") {
    order.status = "READY";
    if (order.fulfillment === "pickup") {
      await sendWhatsAppText(order.customerPhone,
        `🎉 *YOUR FOOD IS READY!*\n\n🆔 Order: ${order.id}\n📍 Branch: ${order.branch}\n🍽️ ${order.food}\n\nYour food is ready for pickup. 🍛\n\nYou can come to the branch and collect your order.\n\nThank you for ordering from ${STORE_NAME}! ❤️`
      );
    } else {
      await sendWhatsAppText(order.customerPhone,
        `🎉 *YOUR FOOD IS READY!*\n\n🆔 Order: ${order.id}\n📍 Branch: ${order.branch}\n🍽️ ${order.food}\n\nYour food has been prepared and is ready for delivery.\n\n🚚 Your rider will be on the way shortly.\n\n💵 Please remember: *PAY ON DELIVERY*.`
      );
    }

    if (order.fulfillment === "delivery") {
      await sendButtons(from, `Order ${order.id} is ready.\n\nChoose the next action:`,
        [{ id: `staff_rider_${order.id}`, title: "🚴 Rider On Way" }]
      );
    } else {
      await sendButtons(from, `Order ${order.id} is ready for pickup.`,
        [{ id: `staff_pickup_${order.id}`, title: "📦 Picked Up" }]
      );
    }
    return;
  }

  if (action === "rider") {
    order.status = "OUT_FOR_DELIVERY";
    await sendWhatsAppText(order.customerPhone,
      `🚴 *YOUR RIDER IS ON THE WAY!*\n\n🆔 Order: ${order.id}\n📍 Branch: ${order.branch}\n\nYour food is on the way.\n\n💵 Payment: *PAY ON DELIVERY*\n\nPlease keep your phone available.\n\nThank you for ordering from ${STORE_NAME}! ❤️`
    );
    return sendWhatsAppText(from, `🚴 Order ${order.id} marked as *OUT FOR DELIVERY*.`);
  }

  if (action === "pickup") {
    order.status = "PICKED_UP";
    await sendWhatsAppText(order.customerPhone,
      `✅ *ORDER PICKED UP*\n\n🆔 ${order.id}\n\nThank you for ordering from ${STORE_NAME}! ❤️\n\nEnjoy your food! 🍛`
    );
    return sendWhatsAppText(from, `📦 Order ${order.id} marked as *PICKED UP*.`);
  }

  return sendWhatsAppText(from, "Unknown staff action.");
}

/*--------------------------------------------------------------------------
 HANDLE INTERACTIVE (detects staff vs customer)
--------------------------------------------------------------------------*/
async function handleInteractive(from, message) {
  const reply = message.interactive;
  const id = reply?.list_reply?.id || reply?.button_reply?.id;
  if (!id) return;

  if (id.startsWith("staff_prepare_")) return handleStaffAction(from, "prepare", id.replace("staff_prepare_", ""));
  if (id.startsWith("staff_ready_"))   return handleStaffAction(from, "ready",   id.replace("staff_ready_", ""));
  if (id.startsWith("staff_rider_"))   return handleStaffAction(from, "rider",   id.replace("staff_rider_", ""));
  if (id.startsWith("staff_pickup_"))  return handleStaffAction(from, "pickup",  id.replace("staff_pickup_", ""));

  return handleCustomerInteractive(from, message);
}

/*--------------------------------------------------------------------------
 WEBHOOK VERIFICATION
--------------------------------------------------------------------------*/
app.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/*--------------------------------------------------------------------------
 WHATSAPP WEBHOOK
--------------------------------------------------------------------------*/
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const value    = req.body?.entry?.[0]?.changes?.[0]?.value;
    const messages = value?.messages || [];

    for (const message of messages) {
      if (!message.from) continue;
      const from = normalizePhone(message.from);

      if (message.type === "text") {
        await handleText(from, message.text?.body);
        continue;
      }
      if (message.type === "interactive") {
        await handleInteractive(from, message);
        continue;
      }
      await sendWhatsAppText(from, "Please use the options provided.");
    }
  } catch (error) {
    console.error("WEBHOOK ERROR:", error.response?.data || error.message);
  }
});

/*--------------------------------------------------------------------------
 ROUTES
--------------------------------------------------------------------------*/
app.get("/",       (req, res) => res.json({ ok: true, store: STORE_NAME, service: "Juljones Food Ordering Bot" }));
app.get("/health", (req, res) => res.json({ ok: true, uptime: process.uptime(), sessions: sessions.size, orders: orders.size, branches: Object.keys(BRANCHES) }));
app.get("/orders", (req, res) => res.json(Array.from(orders.values())));

/*--------------------------------------------------------------------------
 START
--------------------------------------------------------------------------*/
app.listen(PORT, () => {
  console.log(`🍛 ${STORE_NAME} food bot running on port ${PORT}`);
  console.log("Branches:", Object.keys(BRANCHES));
});