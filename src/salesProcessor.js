function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const number = Number(value.replace(/[₹,\s]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function getRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function normalizeSales(payload) {
  return getRows(payload).map((row) => ({
    date: row.date ?? row.Date ?? null,
    manager: row.manager ?? row.Manager ?? null,
    tl: row.tl ?? row.TL ?? null,
    counselor: row.counselor ?? row.Counselor ?? null,
    revenue: toNumber(row.revenue ?? row.Revenue ?? row.amount ?? row.Amount),
    product: row.product ?? row.Product ?? null,
    orderId: row.orderId ?? row.order_id ?? row["Order ID"] ?? null
  }));
}

function managerWiseRevenue(records) {
  const totals = new Map();

  for (const record of records) {
    const manager = record.manager || "Unknown";
    totals.set(manager, (totals.get(manager) || 0) + record.revenue);
  }

  return [...totals.entries()]
    .map(([manager, revenue]) => ({ manager, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
}

module.exports = { normalizeSales, managerWiseRevenue };
