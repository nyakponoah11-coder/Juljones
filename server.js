require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 10000;

/*--------------------------------------------------------------------------

ENVIRONMENT VARIABLES

--------------------------------------------------------------------------*/

const {
  WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_VERIFY_TOKEN,

  ABEKA_BRANCH_NUMBER,
  GCTU_BRANCH_NUMBER,
  RACE_COARSE_BRANCH_NUMBER,
  TOBORA_BRANCH_NUMBER,
  FADAMA_BRANCH_NUMBER,

  STORE_NAME = "Juljones Food"
} = process.env;

const GRAPH_VERSION = process.env.GRAPH_VERSION || "v23.0";

const WA_URL =
  `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

/*--------------------------------------------------------------------------

BRANCHES

--------------------------------------------------------------------------*/

const BRANCHES = {
  "Abeka": {
    number: ABEKA_BRANCH_NUMBER
  },

  "Race Coarse": {
    number: RACE_COARSE_BRANCH_NUMBER
  },

  "Tabora": {
    number: TOBORA_BRANCH_NUMBER
  },

  "GCTU": {
    number: GCTU_BRANCH_NUMBER
  },

  "Fadama": {
    number: FADAMA_BRANCH_NUMBER
  }
};

/*--------------------------------------------------------------------------

RICE / JOLLOF / PLAIN RICE

--------------------------------------------------------------------------*/

const RICE_PORTIONS = [
  { amount: 25, chicken: 1 },
  { amount: 30, chicken: 1 },
  { amount: 40, chicken: 1 },
  { amount: 50, chicken: 2 }
];

/*--------------------------------------------------------------------------

BANKU / KOKONTE / RICE BALL

--------------------------------------------------------------------------*/

const LOCAL_FOOD_AMOUNTS = [];

for (let amount = 5; amount <= 50; amount += 5) {
  LOCAL_FOOD_AMOUNTS.push(amount);
}

/*--------------------------------------------------------------------------

FUFU PRICE

--------------------------------------------------------------------------*/

const FUFU_AMOUNTS = [];

for (let amount = 10; amount <= 50; amount += 5) {
  FUFU_AMOUNTS.push(amount);
}

/*--------------------------------------------------------------------------

WAAKYE PRICE

--------------------------------------------------------------------------*/

const WAAKYE_AMOUNTS = [];

for (let amount = 10; amount <= 50; amount += 5) {
  WAAKYE_AMOUNTS.push(amount);
}

/*--------------------------------------------------------------------------

SOUPS

--------------------------------------------------------------------------*/

const SOUPS = {
  soup_light: {
    name: "Light Soup"
  },

  soup_okro: {
    name: "Okro Stew"
  },

  soup_palmnut: {
    name: "Palmnut Soup"
  },

  soup_groundnut: {
    name: "Groundnut Soup"
  },

  soup_goat: {
    name: "Goat Soup"
  }
};

/*--------------------------------------------------------------------------

WAAKYE ADD-ONS

--------------------------------------------------------------------------*/

const WAAKYE_ADDONS = {
  egg: {
    name: "Egg",
    price: 4,
    emoji: "🥚"
  },

  meat: {
    name: "Meat",
    price: 20,
    emoji: "🍖"
  },

  wele: {
    name: "Wele",
    price: 10,
    emoji: "🐄"
  },

  gari: {
    name: "Gari",
    price: 5,
    emoji: "🌾"
  },

  spaghetti: {
    name: "Spaghetti",
    price: 10,
    emoji: "🍝"
  },

  sausage: {
    name: "Sausage",
    price: 5,
    emoji: "🌭"
  },

  fish: {
    name: "Fish",
    price: 10,
    emoji: "🐟"
  },

  salad: {
    name: "Salad",
    price: 5,
    emoji: "🥗"
  }
};

/*--------------------------------------------------------------------------

LOCAL FOOD PROTEINS

--------------------------------------------------------------------------*/

const LOCAL_PROTEINS = {
  cow_meat: {
    name: "Cow Meat",
    price: 20,
    emoji: "🐄"
  },

  goat_meat: {
    name: "Goat Meat",
    price: 20,
    emoji: "🐐"
  },

  fish: {
    name: "Fish",
    price: 10,
    emoji: "🐟"
  },

  chicken: {
    name: "Chicken",
    price: 20,
    emoji: "🍗"
  },

  intestine: {
    name: "Intestine",
    price: 10,
    emoji: "🐄"
  },

  wele: {
    name: "Wele",
    price: 10,
    emoji: "🐄"
  },

  beef: {
    name: "Beef",
    price: 5,
    emoji: "🥩"
  }
};

const LOCAL_FOODS = [
  "Fufu",
  "Banku",
  "Kokonte",
  "Rice Ball"
];

const PLAIN_RICE_FOODS = [
  "Fried Rice",
  "Jollof Rice",
  "Plain Rice"
];

/*--------------------------------------------------------------------------

SESSIONS AND ORDERS

--------------------------------------------------------------------------*/

const sessions = new Map();
const orders = new Map();

/*--------------------------------------------------------------------------

HELPERS

--------------------------------------------------------------------------*/

function normalizePhone(value) {
  let phone = String(value || "").replace(/\D/g, "");

  if (phone.startsWith("233")) {
    return phone;
  }

  if (phone.startsWith("0")) {
    return "233" + phone.substring(1);
  }

  return phone;
}

function money(amount) {
  return `₵${Number(amount).toFixed(2)}`;
}

function createNewSession() {
  return {
    step: "WELCOME",

    branch: null,

    food: null,

    foodAmount: null,

    soup: null,

    proteins: [],

    includedChicken: 0,

    fulfillment: null,

    address: null,

    order: null
  };
}

function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, createNewSession());
  }

  return sessions.get(phone);
}

function resetSession(phone) {
  sessions.set(phone, createNewSession());
}

/*--------------------------------------------------------------------------

WHATSAPP TEXT

--------------------------------------------------------------------------*/

async function sendWhatsAppText(to, body) {
  const recipient = normalizePhone(to);

  console.log("--------------------------------------------------");
  console.log("📤 SENDING WHATSAPP TEXT");
  console.log("📱 TO:", recipient);
  console.log("📝 MESSAGE:", body.substring(0, 150));
  console.log("--------------------------------------------------");

  const payload = {
    messaging_product: "whatsapp",

    recipient_type: "individual",

    to: recipient,

    type: "text",

    text: {
      preview_url: false,
      body
    }
  };

  try {
    const response = await axios.post(
      WA_URL,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ WHATSAPP MESSAGE SENT");
    console.log("📱 TO:", recipient);

    if (response.data) {
      console.log(
        "📨 META RESPONSE:",
        JSON.stringify(response.data)
      );
    }

    return response;
  } catch (error) {
    console.error("❌ WHATSAPP MESSAGE FAILED");
    console.error("📱 TO:", recipient);

    console.error(
      "❌ META ERROR:",
      JSON.stringify(
        error.response?.data || {
          message: error.message
        },
        null,
        2
      )
    );

    throw error;
  }
}

/*--------------------------------------------------------------------------

WHATSAPP BUTTONS

--------------------------------------------------------------------------*/

async function sendButtons(to, body, buttons) {
  const recipient = normalizePhone(to);

  const payload = {
    messaging_product: "whatsapp",

    recipient_type: "individual",

    to: recipient,

    type: "interactive",

    interactive: {
      type: "button",

      body: {
        text: body
      },

      action: {
        buttons: buttons
          .slice(0, 3)
          .map(button => ({
            type: "reply",

            reply: {
              id: button.id,

              title: String(button.title)
                .substring(0, 20)
            }
          }))
      }
    }
  };

  try {
    const response = await axios.post(
      WA_URL,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ WHATSAPP BUTTONS SENT TO:", recipient);

    return response;
  } catch (error) {
    console.error("❌ WHATSAPP BUTTON SEND FAILED");
    console.error("📱 TO:", recipient);

    console.error(
      "❌ META ERROR:",
      JSON.stringify(
        error.response?.data || {
          message: error.message
        },
        null,
        2
      )
    );

    throw error;
  }
}

/*--------------------------------------------------------------------------

WHATSAPP LIST

--------------------------------------------------------------------------*/

async function sendInteractiveList(
  to,
  body,
  section,
  rows,
  buttonText = "Select"
) {
  const recipient = normalizePhone(to);

  const payload = {
    messaging_product: "whatsapp",

    recipient_type: "individual",

    to: recipient,

    type: "interactive",

    interactive: {
      type: "list",

      body: {
        text: body
      },

      action: {
        button: buttonText.substring(0, 20),

        sections: [
          {
            title: section.substring(0, 24),

            rows: rows
              .slice(0, 10)
              .map(row => ({
                id: row.id,

                title: row.title.substring(0, 24),

                description: row.description
                  ? row.description.substring(0, 72)
                  : undefined
              }))
          }
        ]
      }
    }
  };

  try {
    const response = await axios.post(
      WA_URL,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ WHATSAPP LIST SENT TO:", recipient);

    return response;
  } catch (error) {
    console.error("❌ WHATSAPP LIST SEND FAILED");
    console.error("📱 TO:", recipient);

    console.error(
      "❌ META ERROR:",
      JSON.stringify(
        error.response?.data || {
          message: error.message
        },
        null,
        2
      )
    );

    throw error;
  }
}

/*--------------------------------------------------------------------------

BRANCH LIST

--------------------------------------------------------------------------*/

function branchRows() {
  return Object.keys(BRANCHES).map(
    (branch, index) => ({
      id: `branch_${index}`,

      title: branch,

      description: "Choose this branch"
    })
  );
}

function getBranchFromId(id) {
  const branches = Object.keys(BRANCHES);

  const index = Number(
    String(id).replace("branch_", "")
  );

  return branches[index];
}

/*--------------------------------------------------------------------------

FOOD LIST

--------------------------------------------------------------------------*/

function foodRows() {
  return [
    {
      id: "food_fried_rice",
      title: "Fried Rice",
      description: "₵25 - ₵50"
    },

    {
      id: "food_jollof",
      title: "Jollof Rice",
      description: "₵25 - ₵50"
    },

    {
      id: "food_plain_rice",
      title: "Plain Rice",
      description: "₵25 - ₵50"
    },

    {
      id: "food_waakye",
      title: "Waakye",
      description: "₵10 - ₵50"
    },

    {
      id: "food_fufu",
      title: "Fufu",
      description: "₵10 - ₵50 · Choose soup & protein"
    },

    {
      id: "food_banku",
      title: "Banku",
      description: "₵5 - ₵50 · Choose soup & protein"
    },

    {
      id: "food_kokonte",
      title: "Kokonte",
      description: "₵5 - ₵50 · Choose soup & protein"
    },

    {
      id: "food_rice_ball",
      title: "Rice Ball",
      description: "₵5 - ₵50 · Choose soup & protein"
    }
  ];
}

/*--------------------------------------------------------------------------

RICE AMOUNTS

--------------------------------------------------------------------------*/

function riceAmountRows() {
  return RICE_PORTIONS.map(
    portion => ({
      id: `riceamt_${portion.amount}`,

      title: money(portion.amount),

      description:
        `Includes ${portion.chicken} chicken`
    })
  );
}

/*--------------------------------------------------------------------------

LOCAL FOOD AMOUNTS

--------------------------------------------------------------------------*/

function localFoodAmountRows() {
  return LOCAL_FOOD_AMOUNTS.map(
    amount => ({
      id: `amount_${amount}`,

      title: money(amount),

      description: "Base food amount"
    })
  );
}

/*--------------------------------------------------------------------------

FUFU AMOUNTS

--------------------------------------------------------------------------*/

function fufuAmountRows() {
  return FUFU_AMOUNTS.map(
    amount => ({
      id: `amount_${amount}`,

      title: money(amount),

      description: "Base food amount"
    })
  );
}

/*--------------------------------------------------------------------------

WAAKYE AMOUNTS

--------------------------------------------------------------------------*/

function waakyeAmountRows() {
  return WAAKYE_AMOUNTS.map(
    amount => ({
      id: `waakyeamt_${amount}`,

      title: money(amount),

      description: "Base food amount"
    })
  );
}

/*--------------------------------------------------------------------------

SOUP SELECTION

--------------------------------------------------------------------------*/

function soupRows() {
  return Object.entries(SOUPS).map(
    ([id, item]) => ({
      id,

      title: item.name,

      description: "Choose this soup"
    })
  );
}

/*--------------------------------------------------------------------------

GENERIC ITEM ROWS

--------------------------------------------------------------------------*/

function itemRows(catalog) {
  return Object.entries(catalog).map(
    ([id, item]) => ({
      id: `item_${id}`,

      title:
        `${item.name} — ${money(item.price)}`,

      description: "Tap to add"
    })
  );
}

/*--------------------------------------------------------------------------

CATALOG RESOLUTION

--------------------------------------------------------------------------*/

function getCatalogForSession(session) {
  if (session.food === "Waakye") {
    return WAAKYE_ADDONS;
  }

  if (LOCAL_FOODS.includes(session.food)) {
    return LOCAL_PROTEINS;
  }

  return null;
}

/*--------------------------------------------------------------------------

CALCULATE TOTAL

--------------------------------------------------------------------------*/

function getBaseFoodPrice(session) {
  return Number(session.foodAmount) || 0;
}

function getProteinTotal(session) {
  const catalog =
    getCatalogForSession(session);

  if (!catalog) {
    return 0;
  }

  return session.proteins.reduce(
    (total, itemId) => {
      const item = catalog[itemId];

      return total +
        (item ? item.price : 0);
    },
    0
  );
}

function calculateTotal(session) {
  return (
    getBaseFoodPrice(session) +
    getProteinTotal(session)
  );
}

/*--------------------------------------------------------------------------

PROTEIN / ADD-ON SUMMARY

--------------------------------------------------------------------------*/

function proteinSummary(session) {
  const catalog =
    getCatalogForSession(session);

  if (
    !catalog ||
    !session.proteins.length
  ) {
    return "No extra protein/add-ons";
  }

  const counts = {};

  session.proteins.forEach(itemId => {
    counts[itemId] =
      (counts[itemId] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([itemId, quantity]) => {
      const item = catalog[itemId];

      if (!item) {
        return null;
      }

      return (
        `${item.emoji} ${item.name} x${quantity} — ` +
        `${money(item.price * quantity)}`
      );
    })
    .filter(Boolean)
    .join("\n");
}

/*--------------------------------------------------------------------------

ORDER ID

--------------------------------------------------------------------------*/

function generateOrderId() {
  const now = new Date();

  const date =
    now
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      })
      .replace(/\//g, "-");

  const time =
    now
      .toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      })
      .replace(/:/g, "");

  const rand =
    Math.floor(
      Math.random() * 900 + 100
    );

  return `JUL-${date}-${time}-${rand}`;
}

/*--------------------------------------------------------------------------

ORDER SUMMARY

--------------------------------------------------------------------------*/

function buildOrderSummary(session) {
  const basePrice =
    getBaseFoodPrice(session);

  const soupLine =
    session.soup
      ? `🥣 Soup: ${
          SOUPS[session.soup]?.name ||
          session.soup
        }\n`
      : "";

  const chickenLine =
    session.includedChicken
      ? `🍗 Includes ${session.includedChicken} chicken\n`
      : "";

  const proteinLine =
    session.proteins.length
      ? `\n${proteinSummary(session)}\n`
      : "";

  return `🛍️ *${STORE_NAME.toUpperCase()} ORDER*

📍 Branch: ${session.branch}
🍽️ Food: ${session.food}
💰 Food amount: ${money(basePrice)}
${soupLine}${chickenLine}${proteinLine}━━━━━━━━━━━━━━

💵 *TOTAL: ${money(calculateTotal(session))}*
🚚 Method: ${
    session.fulfillment === "pickup"
      ? "Pick Up"
      : "Delivery — Pay on Delivery"
  }

${
  session.fulfillment === "delivery"
    ? `\n📍 Address:\n${session.address}`
    : ""
}`;
}

/*--------------------------------------------------------------------------

CUSTOMER CONFIRMATION

--------------------------------------------------------------------------*/

async function sendOrderConfirmation(
  to,
  session
) {
  const total =
    calculateTotal(session);

  await sendWhatsAppText(
    to,

    `🧾 *PLEASE CONFIRM YOUR ORDER*

${buildOrderSummary(session)}

━━━━━━━━━━━━━━
Is everything correct?`
  );

  return sendButtons(
    to,

    `Total: ${money(total)}

Would you like to place this order?`,

    [
      {
        id: "confirm_order",
        title: "✅ Place Order"
      },

      {
        id: "cancel_order",
        title: "❌ Cancel"
      }
    ]
  );
}

/*--------------------------------------------------------------------------

SEND ORDER TO BRANCH

THIS IS THE IMPORTANT FIX

--------------------------------------------------------------------------*/

async function sendOrderToBranch(order) {
  console.log("");
  console.log("==================================================");
  console.log("🔔 NEW ORDER - SENDING TO BRANCH");
  console.log("==================================================");

  console.log("🆔 ORDER:", order.id);
  console.log("📍 BRANCH:", order.branch);

  const branch =
    BRANCHES[order.branch];

  if (!branch) {
    console.error(
      `❌ BRANCH DOES NOT EXIST: ${order.branch}`
    );

    return false;
  }

  if (!branch.number) {
    console.error(
      `❌ NO WHATSAPP NUMBER CONFIGURED FOR ${order.branch}`
    );

    console.error(
      "Available branch configuration:"
    );

    console.error(
      JSON.stringify(
        Object.keys(BRANCHES).reduce(
          (result, key) => {
            result[key] =
              BRANCHES[key].number
                ? "CONFIGURED"
                : "MISSING";

            return result;
          },
          {}
        ),
        null,
        2
      )
    );

    return false;
  }

  const branchNumber =
    normalizePhone(branch.number);

  console.log(
    "📱 BRANCH NUMBER:",
    branchNumber
  );

  console.log(
    "📱 CUSTOMER NUMBER:",
    order.customerPhone
  );

  const soupLine =
    order.soup
      ? `🥣 Soup: ${
          SOUPS[order.soup]?.name ||
          order.soup
        }\n`
      : "";

  const chickenLine =
    order.includedChicken
      ? `🍗 Includes ${order.includedChicken} chicken\n`
      : "";

  const proteinLine =
    order.proteinSummary &&
    order.proteinSummary !==
      "No extra protein/add-ons"
      ? `\n🥩 Protein/Add-ons:\n${order.proteinSummary}\n`
      : "";

  const message =
`🔔 *NEW ORDER*

🆔 Order: ${order.id}
📍 Branch: ${order.branch}
📱 Customer: ${order.customerPhone}

🍽️ Food: ${order.food}
💰 Food: ${money(order.basePrice)}
${soupLine}${chickenLine}${proteinLine}
━━━━━━━━━━━━━━

💵 *TOTAL: ${money(order.total)}*

🚚 Method: ${
    order.fulfillment === "pickup"
      ? "PICK UP"
      : "DELIVERY — PAY ON DELIVERY"
  }

${
  order.fulfillment === "delivery"
    ? `\n📍 DELIVERY ADDRESS:\n${order.address}`
    : ""
}

━━━━━━━━━━━━━━

Please start preparing this order.`;

  /*----------------------------------------------------------
  
  SEND ORDER MESSAGE
  
  ----------------------------------------------------------*/

  try {
    console.log(
      "📤 Sending order message to branch..."
    );

    await sendWhatsAppText(
      branchNumber,
      message
    );

    console.log(
      "✅ ORDER MESSAGE SENT TO:",
      branchNumber
    );
  } catch (error) {
    console.error("");
    console.error(
      "=================================================="
    );

    console.error(
      "❌ ORDER COULD NOT BE SENT TO BRANCH"
    );

    console.error(
      "=================================================="
    );

    console.error(
      "📍 Branch:",
      order.branch
    );

    console.error(
      "📱 Number:",
      branchNumber
    );

    console.error(
      "🆔 Order:",
      order.id
    );

    console.error(
      "❌ META ERROR:"
    );

    console.error(
      JSON.stringify(
        error.response?.data || {
          message: error.message
        },
        null,
        2
      )
    );

    console.error(
      "=================================================="
    );

    return false;
  }

  /*----------------------------------------------------------
  
  SEND STAFF BUTTONS
  
  ----------------------------------------------------------*/

  try {
    console.log(
      "📤 Sending staff buttons..."
    );

    await sendButtons(
      branchNumber,

      `Order ${order.id}

What would you like to do?`,

      [
        {
          id:
            `staff_prepare_${order.id}`,
          title:
            "👨‍🍳 Preparing"
        },

        {
          id:
            `staff_ready_${order.id}`,
          title:
            "✅ Food Ready"
        },

        {
          id:
            `staff_rider_${order.id}`,
          title:
            "🚴 Rider On Way"
        }
      ]
    );

    console.log(
      "✅ STAFF BUTTONS SENT TO:",
      branchNumber
    );

  } catch (error) {
    console.error(
      "⚠️ ORDER MESSAGE WAS SENT BUT STAFF BUTTONS FAILED"
    );

    console.error(
      "📍 Branch:",
      order.branch
    );

    console.error(
      "📱 Number:",
      branchNumber
    );

    console.error(
      "❌ META ERROR:",
      JSON.stringify(
        error.response?.data || {
          message: error.message
        },
        null,
        2
      )
    );

    /*
      IMPORTANT:
      We do NOT return false here because
      the actual order message was already delivered.
    */
  }

  console.log(
    "✅ BRANCH ORDER PROCESS COMPLETE"
  );

  console.log(
    "=================================================="
  );

  return true;
}

/*--------------------------------------------------------------------------

WELCOME MESSAGE

--------------------------------------------------------------------------*/

async function showWelcome(to) {
  const message =
`👋 *WELCOME TO ${STORE_NAME.toUpperCase()}!* 🍛

We are happy to serve you.
Enjoy delicious local food from Juljones Food.

🍚 Fried Rice
🍚 Jollof Rice
🍚 Plain Rice
🍛 Waakye
🍚 Rice Ball
🍲 Fufu
🍲 Banku
🍲 Kokonte

📍 First, choose the branch closest to you.`;

  await sendWhatsAppText(
    to,
    message
  );

  return sendInteractiveList(
    to,

    "📍 Which Juljones branch would you like to order from?",

    "Branches",

    branchRows()
  );
}

/*--------------------------------------------------------------------------

HANDLE TEXT

--------------------------------------------------------------------------*/

async function handleText(
  from,
  text
) {
  const input =
    String(text || "").trim();

  const lower =
    input.toLowerCase();

  if (
    [
      "hi",
      "hello",
      "hey",
      "start",
      "menu"
    ].includes(lower)
  ) {
    resetSession(from);

    return showWelcome(from);
  }

  if (
    lower === "restart" ||
    lower === "cancel"
  ) {
    resetSession(from);

    return sendWhatsAppText(
      from,

      "🔄 Your current order has been cancelled.\n\nSend *hi* to start a new order."
    );
  }

  const session =
    getSession(from);

  /*----------------------------------------------------------
  
  ADDRESS
  
  ----------------------------------------------------------*/

  if (
    session.step === "ADDRESS"
  ) {
    session.address = input;

    session.step =
      "CONFIRMATION";

    return sendOrderConfirmation(
      from,
      session
    );
  }

  return sendWhatsAppText(
    from,

    "Please use the selection options above.\n\nSend *hi* if you want to start again."
  );
}

/*--------------------------------------------------------------------------

HANDLE CUSTOMER INTERACTIVE

--------------------------------------------------------------------------*/

async function handleCustomerInteractive(
  from,
  message
) {
  const reply =
    message.interactive;

  const id =
    reply?.list_reply?.id ||
    reply?.button_reply?.id;

  if (!id) {
    return;
  }

  const session =
    getSession(from);

  /*----------------------------------------------------------
  
  BRANCH
  
  ----------------------------------------------------------*/

  if (
    id.startsWith("branch_")
  ) {
    const branch =
      getBranchFromId(id);

    if (!branch) {
      return;
    }

    session.branch =
      branch;

    session.step =
      "FOOD";

    return sendInteractiveList(
      from,

      `📍 *${branch.toUpperCase()} BRANCH SELECTED*

What would you like to eat?`,

      "Food Menu",

      foodRows()
    );
  }

  /*----------------------------------------------------------
  
  FOOD MENU
  
  ----------------------------------------------------------*/

  if (
    id.startsWith("food_")
  ) {
    const foodMap = {
      food_fried_rice:
        "Fried Rice",

      food_jollof:
        "Jollof Rice",

      food_plain_rice:
        "Plain Rice",

      food_waakye:
        "Waakye",

      food_fufu:
        "Fufu",

      food_banku:
        "Banku",

      food_kokonte:
        "Kokonte",

      food_rice_ball:
        "Rice Ball"
    };

    const food =
      foodMap[id];

    if (!food) {
      return;
    }

    session.food =
      food;

    session.foodAmount =
      null;

    session.soup =
      null;

    session.proteins =
      [];

    session.includedChicken =
      0;

    /*--------------------------------------------------------
    
    PLAIN RICE
    
    --------------------------------------------------------*/

    if (
      PLAIN_RICE_FOODS.includes(
        food
      )
    ) {
      session.step =
        "RICE_AMOUNT";

      return sendInteractiveList(
        from,

        `🍚 *${food}*

Choose your price:`,

        "Portions",

        riceAmountRows()
      );
    }

    /*--------------------------------------------------------
    
    WAAKYE
    
    --------------------------------------------------------*/

    if (
      food === "Waakye"
    ) {
      session.step =
        "WAAKYE_AMOUNT";

      return sendInteractiveList(
        from,

        `🍛 *Waakye*

Choose the amount of food you want.

You can select any amount from ₵10 to ₵50.`,

        "Food Amount",

        waakyeAmountRows()
      );
    }

    /*--------------------------------------------------------
    
    FUFU
    
    --------------------------------------------------------*/

    if (
      food === "Fufu"
    ) {
      session.step =
        "LOCAL_AMOUNT";

      return sendInteractiveList(
        from,

        `🍲 *${food}*

Choose the amount of food you want.

You can select any amount from ₵10 to ₵50.`,

        "Food Amount",

        fufuAmountRows()
      );
    }

    /*--------------------------------------------------------
    
    BANKU / KOKONTE / RICE BALL
    
    --------------------------------------------------------*/

    session.step =
      "LOCAL_AMOUNT";

    return sendInteractiveList(
      from,

      `🍲 *${food}*

Choose the amount of food you want.

You can select any amount from ₵5 to ₵50.`,

      "Food Amount",

      localFoodAmountRows()
    );
  }

  /*----------------------------------------------------------
  
  RICE AMOUNT
  
  ----------------------------------------------------------*/

  if (
    id.startsWith("riceamt_")
  ) {
    const amount =
      Number(
        id.replace(
          "riceamt_",
          ""
        )
      );

    const portion =
      RICE_PORTIONS.find(
        item =>
          item.amount === amount
      );

    if (!portion) {
      return;
    }

    session.foodAmount =
      portion.amount;

    session.includedChicken =
      portion.chicken;

    session.step =
      "FULFILLMENT";

    return showFulfillmentOptions(
      from
    );
  }

  /*----------------------------------------------------------
  
  WAAKYE AMOUNT
  
  ----------------------------------------------------------*/

  if (
    id.startsWith("waakyeamt_")
  ) {
    const amount =
      Number(
        id.replace(
          "waakyeamt_",
          ""
        )
      );

    if (
      !WAAKYE_AMOUNTS.includes(
        amount
      )
    ) {
      return;
    }

    session.foodAmount =
      amount;

    session.proteins =
      [];

    session.step =
      "PROTEIN";

    return sendInteractiveList(
      from,

      `🍛 Waakye: ${money(amount)}

Now choose your add-ons.

You can add more than one.`,

      "Add-ons",

      itemRows(
        WAAKYE_ADDONS
      )
    );
  }

  /*----------------------------------------------------------
  
  LOCAL FOOD AMOUNT
  
  ----------------------------------------------------------*/

  if (
    id.startsWith("amount_")
  ) {
    const amount =
      Number(
        id.replace(
          "amount_",
          ""
        )
      );

    const validAmounts =
      session.food === "Fufu"
        ? FUFU_AMOUNTS
        : LOCAL_FOOD_AMOUNTS;

    if (
      !validAmounts.includes(
        amount
      )
    ) {
      return;
    }

    session.foodAmount =
      amount;

    session.step =
      "SOUP";

    return sendInteractiveList(
      from,

      `${session.food}: ${money(amount)}

Now choose your soup:`,

      "Soup",

      soupRows()
    );
  }

  /*----------------------------------------------------------
  
  SOUP
  
  ----------------------------------------------------------*/

  if (
    id in SOUPS
  ) {
    session.soup =
      id;

    session.proteins =
      [];

    session.step =
      "PROTEIN";

    return sendInteractiveList(
      from,

      `🥣 ${SOUPS[id].name} selected.

Now choose your protein:`,

      "Protein",

      itemRows(
        LOCAL_PROTEINS
      )
    );
  }

  /*----------------------------------------------------------
  
  PROTEIN / ADD-ON
  
  ----------------------------------------------------------*/

  if (
    id.startsWith("item_")
  ) {
    const catalog =
      getCatalogForSession(
        session
      );

    const itemId =
      id.replace(
        "item_",
        ""
      );

    if (
      !catalog ||
      !catalog[itemId]
    ) {
      return;
    }

    session.proteins.push(
      itemId
    );

    const item =
      catalog[itemId];

    await sendWhatsAppText(
      from,

      `✅ ${item.emoji} ${item.name} added — ${money(item.price)}

Current total: ${money(calculateTotal(session))}`
    );

    return sendButtons(
      from,

      "Would you like to add another protein/add-on?",

      [
        {
          id: "add_more_protein",
          title: "➕ Add More"
        },

        {
          id: "done_protein",
          title: "✅ Done"
        }
      ]
    );
  }

  /*----------------------------------------------------------
  
  ADD MORE
  
  ----------------------------------------------------------*/

  if (
    id === "add_more_protein"
  ) {
    const catalog =
      getCatalogForSession(
        session
      );

    if (!catalog) {
      return;
    }

    session.step =
      "PROTEIN";

    return sendInteractiveList(
      from,

      "Choose another protein/add-on:",

      "Protein",

      itemRows(catalog)
    );
  }

  /*----------------------------------------------------------
  
  DONE PROTEIN
  
  ----------------------------------------------------------*/

  if (
    id === "done_protein"
  ) {
    session.step =
      "FULFILLMENT";

    return showFulfillmentOptions(
      from
    );
  }

  /*----------------------------------------------------------
  
  PICKUP
  
  ----------------------------------------------------------*/

  if (
    id === "pickup"
  ) {
    session.fulfillment =
      "pickup";

    session.step =
      "CONFIRMATION";

    return sendOrderConfirmation(
      from,
      session
    );
  }

  /*----------------------------------------------------------
  
  DELIVERY
  
  ----------------------------------------------------------*/

  if (
    id === "delivery"
  ) {
    session.fulfillment =
      "delivery";

    session.step =
      "ADDRESS";

    return sendWhatsAppText(
      from,

      `🚚 *DELIVERY SELECTED*

💵 Payment is *ON DELIVERY*.

Please send your full delivery address.

For example:

Area:
House number/name:
Nearest landmark:

Please send all the details in one message.`
    );
  }

  /*----------------------------------------------------------
  
  CONFIRM ORDER
  
  ----------------------------------------------------------*/

  if (
    id === "confirm_order"
  ) {
    return placeCustomerOrder(
      from,
      session
    );
  }

  /*----------------------------------------------------------
  
  CANCEL ORDER
  
  ----------------------------------------------------------*/

  if (
    id === "cancel_order"
  ) {
    resetSession(from);

    return sendWhatsAppText(
      from,

      "❌ Order cancelled.\n\nSend *hi* whenever you want to order again."
    );
  }
}

/*--------------------------------------------------------------------------

FULFILLMENT OPTIONS

--------------------------------------------------------------------------*/

async function showFulfillmentOptions(
  to
) {
  return sendInteractiveList(
    to,

    "🚚 How would you like to receive your food?",

    "Order Method",

    [
      {
        id: "pickup",

        title: "Pick Up",

        description:
          "Come to the selected branch"
      },

      {
        id: "delivery",

        title: "Delivery",

        description:
          "Pay the rider on delivery"
      }
    ]
  );
}

/*--------------------------------------------------------------------------

PLACE ORDER

--------------------------------------------------------------------------*/

async function placeCustomerOrder(
  from,
  session
) {
  console.log("");
  console.log(
    "=================================================="
  );

  console.log(
    "🛒 CUSTOMER IS PLACING ORDER"
  );

  console.log(
    "=================================================="
  );

  console.log(
    "📱 CUSTOMER:",
    from
  );

  console.log(
    "📍 SELECTED BRANCH:",
    session.branch
  );

  console.log(
    "🍽️ FOOD:",
    session.food
  );

  console.log(
    "💵 TOTAL:",
    money(
      calculateTotal(session)
    )
  );

  const order = {
    id:
      generateOrderId(),

    customerPhone:
      from,

    branch:
      session.branch,

    food:
      session.food,

    basePrice:
      getBaseFoodPrice(
        session
      ),

    soup:
      session.soup || null,

    includedChicken:
      session.includedChicken || 0,

    proteins:
      [...session.proteins],

    proteinSummary:
      proteinSummary(
        session
      ),

    total:
      calculateTotal(
        session
      ),

    fulfillment:
      session.fulfillment,

    address:
      session.address || null,

    status:
      "NEW",

    createdAt:
      new Date().toISOString()
  };

  /*----------------------------------------------------------
  
  SAVE ORDER
  
  ----------------------------------------------------------*/

  orders.set(
    order.id,
    order
  );

  console.log(
    "💾 ORDER SAVED:",
    order.id
  );

  /*----------------------------------------------------------
  
  SEND TO SELECTED BRANCH
  
  ----------------------------------------------------------*/

  const branchSent =
    await sendOrderToBranch(
      order
    );

  /*----------------------------------------------------------
  
  IF BRANCH SEND FAILED
  
  ----------------------------------------------------------*/

  if (!branchSent) {
    console.error(
      `❌ FAILED TO SEND ORDER ${order.id} TO ${order.branch}`
    );

    return sendWhatsAppText(
      from,

      `❌ We couldn't send your order to the ${order.branch} branch.

Please try again later or send *hi* to restart.`
    );
  }

  /*----------------------------------------------------------
  
  CUSTOMER SUCCESS MESSAGE
  
  ----------------------------------------------------------*/

  await sendWhatsAppText(
    from,

    `🎉 *ORDER PLACED SUCCESSFULLY!*

🆔 Order: ${order.id}
📍 Branch: ${order.branch}
🍽️ Food: ${order.food}
💵 Total: ${money(order.total)}
🚚 Method: ${
      order.fulfillment === "pickup"
        ? "Pick Up"
        : "Delivery — Pay on Delivery"
    }

${
  order.fulfillment === "delivery"
    ? `\n📍 Address:\n${order.address}`
    : ""
}

━━━━━━━━━━━━━━

Your order has been sent to the branch.

We will notify you when your food is ready. ❤️`
  );

  session.order =
    order;

  session.step =
    "ORDER_PLACED";

  console.log(
    `🎉 ORDER ${order.id} COMPLETED`
  );
}

/*--------------------------------------------------------------------------

STAFF ORDER STATUS

--------------------------------------------------------------------------*/

async function handleStaffAction(
  from,
  action,
  orderId
) {
  const order =
    orders.get(orderId);

  if (!order) {
    return sendWhatsAppText(
      from,

      `❌ Order ${orderId} was not found.`
    );
  }

  /*----------------------------------------------------------
  
  PREPARING
  
  ----------------------------------------------------------*/

  if (
    action === "prepare"
  ) {
    order.status =
      "PREPARING";

    await sendWhatsAppText(
      order.customerPhone,

      `👨‍🍳 *YOUR ORDER IS BEING PREPARED*

🆔 ${order.id}
🍽️ ${order.food}
📍 ${order.branch}

Your food is now being prepared.

We'll notify you when it is ready. ❤️`
    );

    return sendWhatsAppText(
      from,

      `👨‍🍳 Order ${order.id} is now marked as *PREPARING*.`
    );
  }

  /*----------------------------------------------------------
  
  READY
  
  ----------------------------------------------------------*/

  if (
    action === "ready"
  ) {
    order.status =
      "READY";

    if (
      order.fulfillment ===
      "pickup"
    ) {
      await sendWhatsAppText(
        order.customerPhone,

        `🎉 *YOUR FOOD IS READY!*

🆔 Order: ${order.id}
📍 Branch: ${order.branch}
🍽️ ${order.food}

Your food is ready for pickup. 🍛

You can come to the branch and collect your order.

Thank you for ordering from ${STORE_NAME}! ❤️`
      );
    } else {
      await sendWhatsAppText(
        order.customerPhone,

        `🎉 *YOUR FOOD IS READY!*

🆔 Order: ${order.id}
📍 Branch: ${order.branch}
🍽️ ${order.food}

Your food has been prepared and is ready for delivery.

🚚 Your rider will be on the way shortly.

💵 Please remember: *PAY ON DELIVERY*.`
      );
    }

    /*--------------------------------------------------------
    
    DELIVERY
    
    --------------------------------------------------------*/

    if (
      order.fulfillment ===
      "delivery"
    ) {
      await sendButtons(
        from,

        `Order ${order.id} is ready.

Choose the next action:`,

        [
          {
            id:
              `staff_rider_${order.id}`,

            title:
              "🚴 Rider On Way"
          }
        ]
      );
    }

    /*--------------------------------------------------------
    
    PICKUP
    
    --------------------------------------------------------*/

    else {
      await sendButtons(
        from,

        `Order ${order.id} is ready for pickup.`,

        [
          {
            id:
              `staff_pickup_${order.id}`,

            title:
              "📦 Picked Up"
          }
        ]
      );
    }

    return;
  }

  /*----------------------------------------------------------
  
  RIDER
  
  ----------------------------------------------------------*/

  if (
    action === "rider"
  ) {
    order.status =
      "OUT_FOR_DELIVERY";

    await sendWhatsAppText(
      order.customerPhone,

      `🚴 *YOUR RIDER IS ON THE WAY!*

🆔 Order: ${order.id}
📍 Branch: ${order.branch}

Your food is on the way.

💵 Payment: *PAY ON DELIVERY*

Please keep your phone available.

Thank you for ordering from ${STORE_NAME}! ❤️`
    );

    return sendWhatsAppText(
      from,

      `🚴 Order ${order.id} marked as *OUT FOR DELIVERY*.`
    );
  }

  /*----------------------------------------------------------
  
  PICKED UP
  
  ----------------------------------------------------------*/

  if (
    action === "pickup"
  ) {
    order.status =
      "PICKED_UP";

    await sendWhatsAppText(
      order.customerPhone,

      `✅ *ORDER PICKED UP*

🆔 ${order.id}

Thank you for ordering from ${STORE_NAME}! ❤️

Enjoy your food! 🍛`
    );

    return sendWhatsAppText(
      from,

      `📦 Order ${order.id} marked as *PICKED UP*.`
    );
  }

  return sendWhatsAppText(
    from,

    "Unknown staff action."
  );
}

/*--------------------------------------------------------------------------

HANDLE INTERACTIVE

--------------------------------------------------------------------------*/

async function handleInteractive(
  from,
  message
) {
  const reply =
    message.interactive;

  const id =
    reply?.list_reply?.id ||
    reply?.button_reply?.id;

  if (!id) {
    return;
  }

  /*----------------------------------------------------------
  
  STAFF ACTIONS
  
  ----------------------------------------------------------*/

  if (
    id.startsWith(
      "staff_prepare_"
    )
  ) {
    return handleStaffAction(
      from,
      "prepare",
      id.replace(
        "staff_prepare_",
        ""
      )
    );
  }

  if (
    id.startsWith(
      "staff_ready_"
    )
  ) {
    return handleStaffAction(
      from,
      "ready",
      id.replace(
        "staff_ready_",
        ""
      )
    );
  }

  if (
    id.startsWith(
      "staff_rider_"
    )
  ) {
    return handleStaffAction(
      from,
      "rider",
      id.replace(
        "staff_rider_",
        ""
      )
    );
  }

  if (
    id.startsWith(
      "staff_pickup_"
    )
  ) {
    return handleStaffAction(
      from,
      "pickup",
      id.replace(
        "staff_pickup_",
        ""
      )
    );
  }

  /*----------------------------------------------------------
  
  CUSTOMER
  
  ----------------------------------------------------------*/

  return handleCustomerInteractive(
    from,
    message
  );
}

/*--------------------------------------------------------------------------

WEBHOOK VERIFICATION

--------------------------------------------------------------------------*/

app.get(
  "/webhook",
  (req, res) => {
    const mode =
      req.query[
        "hub.mode"
      ];

    const token =
      req.query[
        "hub.verify_token"
      ];

    const challenge =
      req.query[
        "hub.challenge"
      ];

    console.log(
      "🔐 WEBHOOK VERIFICATION REQUEST"
    );

    if (
      mode === "subscribe" &&
      token ===
        WHATSAPP_VERIFY_TOKEN
    ) {
      console.log(
        "✅ WEBHOOK VERIFIED"
      );

      return res
        .status(200)
        .send(challenge);
    }

    console.error(
      "❌ WEBHOOK VERIFICATION FAILED"
    );

    return res.sendStatus(
      403
    );
  }
);

/*--------------------------------------------------------------------------

WHATSAPP WEBHOOK

--------------------------------------------------------------------------*/

app.post(
  "/webhook",
  async (req, res) => {
    /*
      Respond immediately to Meta.
    */
    res.sendStatus(200);

    try {
      const value =
        req.body
          ?.entry?.[0]
          ?.changes?.[0]
          ?.value;

      const messages =
        value?.messages || [];

      console.log(
        "📩 WHATSAPP WEBHOOK RECEIVED"
      );

      console.log(
        "📨 MESSAGES:",
        messages.length
      );

      for (
        const message
        of messages
      ) {
        if (!message.from) {
          continue;
        }

        const from =
          normalizePhone(
            message.from
          );

        console.log(
          "📱 MESSAGE FROM:",
          from
        );

        console.log(
          "📦 MESSAGE TYPE:",
          message.type
        );

        /*------------------------------------------------------
        
        TEXT
        
        ------------------------------------------------------*/

        if (
          message.type === "text"
        ) {
          await handleText(
            from,
            message.text?.body
          );

          continue;
        }

        /*------------------------------------------------------
        
        INTERACTIVE
        
        ------------------------------------------------------*/

        if (
          message.type ===
          "interactive"
        ) {
          await handleInteractive(
            from,
            message
          );

          continue;
        }

        await sendWhatsAppText(
          from,

          "Please use the options provided."
        );
      }
    } catch (error) {
      console.error(
        "=================================================="
      );

      console.error(
        "❌ WEBHOOK ERROR"
      );

      console.error(
        "=================================================="
      );

      console.error(
        JSON.stringify(
          error.response?.data || {
            message:
              error.message
          },
          null,
          2
        )
      );

      console.error(
        "=================================================="
      );
    }
  }
);

/*--------------------------------------------------------------------------

HOME

--------------------------------------------------------------------------*/

app.get(
  "/",
  (req, res) => {
    res.json({
      ok: true,

      store:
        STORE_NAME,

      service:
        "Juljones Food Ordering Bot"
    });
  }
);

/*--------------------------------------------------------------------------

HEALTH

--------------------------------------------------------------------------*/

app.get(
  "/health",
  (req, res) => {
    res.json({
      ok: true,

      uptime:
        process.uptime(),

      sessions:
        sessions.size,

      orders:
        orders.size,

      branches:
        Object.keys(BRANCHES)
    });
  }
);

/*--------------------------------------------------------------------------

ORDERS

--------------------------------------------------------------------------*/

app.get(
  "/orders",
  (req, res) => {
    res.json(
      Array.from(
        orders.values()
      )
    );
  }
);

/*--------------------------------------------------------------------------

BRANCH DEBUG ROUTE

DO NOT USE THIS TO SHOW NUMBERS PUBLICLY IN PRODUCTION.

IT ONLY SHOWS WHETHER EACH NUMBER IS CONFIGURED.

--------------------------------------------------------------------------*/

app.get(
  "/branch-status",
  (req, res) => {
    const status =
      Object.keys(
        BRANCHES
      ).map(branch => ({
        branch,

        configured:
          Boolean(
            BRANCHES[branch]
              .number
          ),

        normalized:
          BRANCHES[branch]
            .number
            ? normalizePhone(
                BRANCHES[branch]
                  .number
              )
            : null
      }));

    res.json({
      ok: true,
      branches: status
    });
  }
);

/*--------------------------------------------------------------------------

START SERVER

--------------------------------------------------------------------------*/

app.listen(
  PORT,
  () => {
    console.log("");
    console.log(
      "=================================================="
    );

    console.log(
      `🍛 ${STORE_NAME} FOOD BOT RUNNING`
    );

    console.log(
      "=================================================="
    );

    console.log(
      "PORT:",
      PORT
    );

    console.log(
      "GRAPH VERSION:",
      GRAPH_VERSION
    );

    console.log(
      "WHATSAPP PHONE NUMBER ID:",
      WHATSAPP_PHONE_NUMBER_ID
        ? "CONFIGURED"
        : "❌ MISSING"
    );

    console.log(
      "WHATSAPP ACCESS TOKEN:",
      WHATSAPP_ACCESS_TOKEN
        ? "CONFIGURED"
        : "❌ MISSING"
    );

    console.log(
      "WHATSAPP VERIFY TOKEN:",
      WHATSAPP_VERIFY_TOKEN
        ? "CONFIGURED"
        : "❌ MISSING"
    );

    console.log("");

    console.log(
      "📍 BRANCH CONFIGURATION:"
    );

    Object.keys(
      BRANCHES
    ).forEach(branch => {
      const number =
        BRANCHES[branch]
          .number;

      console.log(
        `${branch}: ${
          number
            ? `✅ CONFIGURED (${normalizePhone(number)})`
            : "❌ MISSING"
        }`
      );
    });

    console.log("");

    console.log(
      "=================================================="
    );
  }
);