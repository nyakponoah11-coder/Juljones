const PDFDocument = require("pdfkit");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function getPeriodRange(period, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "weekly") {
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
  }
  if (period === "monthly") start.setDate(1);

  const end = new Date(start);
  if (period === "daily") end.setDate(end.getDate() + 1);
  if (period === "weekly") end.setDate(end.getDate() + 7);
  if (period === "monthly") end.setMonth(end.getMonth() + 1);

  return { start, end };
}

function isInRange(order, range) {
  const createdAt = new Date(order.createdAt);
  return createdAt >= range.start && createdAt < range.end;
}

async function saveOrder(order) {
  if (!supabase) return;
  const { error } = await supabase.from("orders").insert({
    id: order.id,
    branch: order.branch,
    customer_phone: order.customerPhone,
    food: order.food,
    base_price: order.basePrice,
    soup: order.soup,
    included_chicken: order.includedChicken,
    proteins: order.proteins,
    protein_summary: order.proteinSummary,
    total: order.total,
    fulfillment: order.fulfillment,
    address: order.address,
    status: order.status,
    created_at: order.createdAt
  });
  if (error) throw error;
}

async function getOrders(branch, period, fallbackOrders) {
  const range = getPeriodRange(period);
  const localOrders = Array.from(fallbackOrders.values())
    .filter(order => order.branch === branch && isInRange(order, range));

  if (!supabase) return localOrders;

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("branch", branch)
    .gte("created_at", range.start.toISOString())
    .lt("created_at", range.end.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    console.error("SUPABASE REPORT ERROR:", error.message);
    return localOrders;
  }

  const storedOrders = data.map(order => ({
    ...order,
    customerPhone: order.customer_phone,
    basePrice: order.base_price,
    includedChicken: order.included_chicken,
    proteinSummary: order.protein_summary,
    fulfillment: order.fulfillment,
    createdAt: order.created_at
  }));

  const combined = [...storedOrders, ...localOrders];
  const seen = new Set();
  return combined.filter(order => {
    const key = `${order.id}|${order.createdAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
}

function money(value) {
  return `GHS ${Number(value || 0).toFixed(2)}`;
}

function createReportPdf(branch, period, orders) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const total = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    doc.fontSize(20).font("Helvetica-Bold").text("JULJONES FOOD");
    doc.moveDown(0.3).fontSize(15).text(`${period.toUpperCase()} ORDER REPORT`);
    doc.moveDown(0.3).fontSize(11).font("Helvetica").text(`Branch: ${branch}`);
    doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`);
    doc.moveDown().font("Helvetica-Bold").text(`Orders: ${orders.length}`);
    doc.text(`Total sales: ${money(total)}`);
    doc.moveDown();
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown();

    if (!orders.length) {
      doc.font("Helvetica").text("No orders were placed during this period.");
    } else {
      orders.forEach((order, index) => {
        doc.font("Helvetica-Bold").text(`${index + 1}. ${order.id}  |  ${money(order.total)}`);
        doc.font("Helvetica").text(`Food: ${order.food}  |  Method: ${order.fulfillment || "-"}`);
        if (order.soup) doc.text(`Soup: ${order.soup}`);
        if (order.proteinSummary) doc.text(`Proteins: ${order.proteinSummary.replace(/[\r\n]+/g, ", ")}`);
        doc.text(`Customer: ${order.customerPhone || "-"}  |  ${new Date(order.createdAt).toLocaleString("en-GB")}`);
        doc.moveDown(0.7);
      });
    }

    doc.end();
  });
}

module.exports = { createReportPdf, getOrders, getPeriodRange, saveOrder };