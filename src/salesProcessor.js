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

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeSales(payload) {
  return getRows(payload).map((row) => ({
    date: row.date ?? row.Date ?? row.created_at ?? row.createdAt ?? null,
    manager: row.manager ?? row.Manager ?? null,
    tl: row.tl ?? row.TL ?? row.team_leader ?? row.teamLeader ?? null,
    counselor: row.counselor ?? row.Counselor ?? null,
    revenue: toNumber(row.revenue ?? row.Revenue ?? row.amount ?? row.Amount),
    product: row.product ?? row.Product ?? null,
    orderId: row.orderId ?? row.order_id ?? row["Order ID"] ?? row.order ?? null
  }));
}

function aggregateBy(records, field, label) {
  const totals = new Map();

  for (const record of records) {
    const key = record[field] || "Unknown";
    const current = totals.get(key) || { [label]: key, revenue: 0, orders: 0 };
    current.revenue += record.revenue;
    current.orders += 1;
    totals.set(key, current);
  }

  return [...totals.values()].sort((a, b) => b.revenue - a.revenue);
}

function managerWiseRevenue(records) {
  return aggregateBy(records, "manager", "manager");
}

function tlWiseRevenue(records) {
  return aggregateBy(records, "tl", "tl");
}

function isSameDay(dateValue, referenceDate = new Date()) {
  const date = normalizeDate(dateValue);
  if (!date) return false;

  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth() &&
    date.getDate() === referenceDate.getDate()
  );
}

function isSameMonth(dateValue, referenceDate = new Date()) {
  const date = normalizeDate(dateValue);
  if (!date) return false;

  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth()
  );
}

function summary(records, referenceDate = new Date()) {
  const todayRecords = records.filter((record) => isSameDay(record.date, referenceDate));
  const mtdRecords = records.filter((record) => isSameMonth(record.date, referenceDate));

  const sumRevenue = (rows) => rows.reduce((sum, row) => sum + row.revenue, 0);

  return {
    totalRevenue: sumRevenue(records),
    totalOrders: records.length,
    todayRevenue: sumRevenue(todayRecords),
    todayOrders: todayRecords.length,
    mtdRevenue: sumRevenue(mtdRecords),
    mtdOrders: mtdRecords.length,
    managerRevenue: managerWiseRevenue(records),
    tlRevenue: tlWiseRevenue(records)
  };
}

module.exports = {
  normalizeSales,
  managerWiseRevenue,
  tlWiseRevenue,
  summary
};
