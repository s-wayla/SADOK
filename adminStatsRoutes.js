// routes/adminStatsRoutes.js
const express = require('express');
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

/**
 * ملاحظة مهمة:
 * في server.js يتم تركيب هذا الراوتر على: app.use('/api/admin/stats', adminStatsRoutes)
 * لذلك المسارات هنا يجب أن تكون نسبية مثل '/orders' وليس '/admin/stats/orders'
 */

// ===== Helpers =====
function buildDateSql(column, period) {
  switch (period) {
    case 'daily':
      return {
        label: `TO_CHAR(${column}, 'YYYY-MM-DD')`,
        group: `TO_CHAR(${column}, 'YYYY-MM-DD')`,
        order: `1 DESC`,
        limit: `LIMIT 30`,
      };
    case 'weekly':
      // ISO week label: 2025-W33
      return {
        label: `TO_CHAR(${column}, 'IYYY-"W"IW')`,
        group: `TO_CHAR(${column}, 'IYYY-"W"IW')`,
        order: `MIN(${column}) DESC`,
        limit: `LIMIT 10`,
      };
    case 'monthly':
      return {
        label: `TO_CHAR(${column}, 'YYYY-MM')`,
        group: `TO_CHAR(${column}, 'YYYY-MM')`,
        order: `1 DESC`,
        limit: `LIMIT 12`,
      };
    case 'yearly':
      return {
        label: `TO_CHAR(${column}, 'YYYY')`,
        group: `TO_CHAR(${column}, 'YYYY')`,
        order: `1 DESC`,
        limit: ``,
      };
    default:
      return null;
  }
}

function buildRangeWhere(column, start, end, params) {
  const parts = [];
  if (start) {
    params.push(start);
    parts.push(`${column} >= $${params.length}`);
  }
  if (end) {
    params.push(end);
    parts.push(`${column} <= $${params.length}`);
  }
  return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
}

// أداة تُرجع where وparams جديدة لكل جدول حتى لا نعيد استخدام نفس المصفوفة عبر عدة استعلامات
function whereForTable(table, start, end) {
  const colMap = {
    vendors: 'created_at',
    users: 'created_at',
    products: 'created_at',
    orders: 'order_date',
    returns: 'created_at',
  };
  const col = colMap[table];
  const params = [];
  const parts = [];
  if (start) { params.push(start); parts.push(`${col} >= $${params.length}`); }
  if (end)   { params.push(end);   parts.push(`${col} <= $${params.length}`); }
  return {
    clause: parts.length ? `WHERE ${parts.join(' AND ')}` : '',
    params,
  };
}

// ========================= Products stats =========================
/**
 * GET /products
 * ?period=daily|weekly|monthly|yearly
 * ?start=YYYY-MM-DD&end=YYYY-MM-DD   (فلترة نطاق زمني مخصّص)
 */
router.get('/products', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { period, start, end } = req.query;
    const col = 'created_at';
    const params = [];
    const where = buildRangeWhere(col, start, end, params);

    // نطاق زمني فقط دون period → إجمالي موحّد
    if (!period && (start || end)) {
      const q = `
        SELECT 
          COALESCE(COUNT(*), 0) AS count,
          COALESCE(SUM(price * stock), 0) AS total_value
        FROM products
        ${where};
      `;
      const r = await db.query(q, params);
      return res.json([{
        label: 'إجمالي',
        count: parseInt(r.rows[0].count),
        total: parseFloat(r.rows[0].total_value || 0).toFixed(2),
      }]);
    }

    const d = buildDateSql(col, period || 'monthly');
    const q = `
      SELECT ${d.label} AS label,
             COUNT(*) AS count,
             COALESCE(SUM(price * stock), 0) AS total_value
      FROM products
      ${where}
      GROUP BY ${d.group}
      ORDER BY ${d.order}
      ${d.limit};
    `;
    const r = await db.query(q, params);
    const data = r.rows.map(row => ({
      label: row.label,
      count: parseInt(row.count),
      total: parseFloat(row.total_value || 0).toFixed(2),
    }));
    res.json(data);
  } catch (err) {
    console.error('Error fetching product stats:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// ========================= Vendors stats =========================
/**
 * GET /vendors
 * يدعم period و/أو start/end مثل /products
 */
router.get('/vendors', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { period, start, end } = req.query;
    const col = 'created_at';
    const params = [];
    const where = buildRangeWhere(col, start, end, params);

    if (!period && (start || end)) {
      const q = `
        SELECT COALESCE(COUNT(*), 0) AS count,
               COALESCE(SUM(total_sales), 0) AS total_value
        FROM vendors
        ${where};
      `;
      const r = await db.query(q, params);
      return res.json([{
        label: 'إجمالي',
        count: parseInt(r.rows[0].count),
        total: parseFloat(r.rows[0].total_value || 0).toFixed(2),
      }]);
    }

    const d = buildDateSql(col, period || 'monthly');
    const q = `
      SELECT ${d.label} AS label,
             COUNT(*) AS count,
             COALESCE(SUM(total_sales), 0) AS total_value
      FROM vendors
      ${where}
      GROUP BY ${d.group}
      ORDER BY ${d.order}
      ${d.limit};
    `;
    const r = await db.query(q, params);
    const data = r.rows.map(row => ({
      label: row.label,
      count: parseInt(row.count),
      total: parseFloat(row.total_value || 0).toFixed(2),
    }));
    res.json(data);
  } catch (err) {
    console.error('Error fetching vendor stats:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// ========================= Orders stats =========================
/**
 * GET /orders
 * يدعم period و/أو start/end مثل /products
 */
router.get('/orders', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { period, start, end } = req.query;
    const col = 'order_date';
    const params = [];
    const where = buildRangeWhere(col, start, end, params);

    if (!period && (start || end)) {
      const q = `
        SELECT COALESCE(COUNT(*), 0) AS count,
               COALESCE(SUM(total_amount), 0) AS total_value
        FROM orders
        ${where};
      `;
      const r = await db.query(q, params);
      return res.json([{
        label: 'إجمالي',
        count: parseInt(r.rows[0].count),
        total: parseFloat(r.rows[0].total_value || 0).toFixed(2),
      }]);
    }

    const d = buildDateSql(col, period || 'monthly');
    const q = `
      SELECT ${d.label} AS label,
             COUNT(*) AS count,
             COALESCE(SUM(total_amount), 0) AS total_value
      FROM orders
      ${where}
      GROUP BY ${d.group}
      ORDER BY ${d.order}
      ${d.limit};
    `;
    const r = await db.query(q, params);
    const data = r.rows.map(row => ({
      label: row.label,
      count: parseInt(row.count),
      total: parseFloat(row.total_value || 0).toFixed(2),
    }));
    res.json(data);
  } catch (err) {
    console.error('Error fetching order stats:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// ========================= Revenue stats (delivered only) =========================
/**
 * GET /revenue
 * مجموع مبالغ الطلبات المسلّمة فقط (status='delivered')
 * يدعم period و/أو start/end
 */
router.get('/revenue', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { period, start, end } = req.query;
    const col = 'order_date';
    const params = [];
    const wherePieces = [`status = 'delivered'`];
    if (start) { params.push(start); wherePieces.push(`${col} >= $${params.length}`); }
    if (end)   { params.push(end);   wherePieces.push(`${col} <= $${params.length}`); }
    const where = `WHERE ${wherePieces.join(' AND ')}`;

    if (!period && (start || end)) {
      const q = `SELECT COALESCE(SUM(total_amount), 0) AS sales FROM orders ${where};`;
      const r = await db.query(q, params);
      return res.json([{ label: 'إجمالي', sales: parseFloat(r.rows[0].sales || 0).toFixed(2) }]);
    }

    const d = buildDateSql(col, period || 'monthly');
    const q = `
      SELECT ${d.label} AS label,
             COALESCE(SUM(total_amount), 0) AS sales
      FROM orders
      ${where}
      GROUP BY ${d.group}
      ORDER BY ${d.order}
      ${d.limit};
    `;
    const r = await db.query(q, params);
    const data = r.rows.map(row => ({
      label: row.label,
      sales: parseFloat(row.sales || 0).toFixed(2),
    }));
    res.json(data);
  } catch (err) {
    console.error('Error fetching revenue stats:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// ========================= Overview (summary) مع دعم period/start/end =========================
/**
 * GET /overview
 * ملخّص عام يتأثر بـ period/start/end
 */
router.get('/overview', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { period, start, end } = req.query;

    // ===== إجمالي المبيعات (طلبات مُسلّمة) ضمن النطاق =====
    const salesParams = [];
    const salesWhereParts = [`status = 'delivered'`];
    if (start) { salesParams.push(start); salesWhereParts.push(`order_date >= $${salesParams.length}`); }
    if (end)   { salesParams.push(end);   salesWhereParts.push(`order_date <= $${salesParams.length}`); }
    const salesWhere = `WHERE ${salesWhereParts.join(' AND ')}`;

    // ===== أعداد الكيانات ضمن النطاق =====
    const wVendors = whereForTable('vendors', start, end);
    const wUsers   = whereForTable('users',   start, end);
    const wProducts= whereForTable('products',start, end);
    const wOrders  = whereForTable('orders',  start, end);
    const wReturns = whereForTable('returns', start, end);

    // ===== إجمالي العمولات ضمن النطاق =====
    const commissionParams = [];
    const commissionWhereParts = [];
    if (start) { commissionParams.push(start); commissionWhereParts.push(`o.order_date >= $${commissionParams.length}`); }
    if (end)   { commissionParams.push(end);   commissionWhereParts.push(`o.order_date <= $${commissionParams.length}`); }
    const commissionWhere = commissionWhereParts.length ? `WHERE ${commissionWhereParts.join(' AND ')}` : '';

    // ===== Top Vendors / Products ضمن النطاق =====
    const topParams = wOrders.params.slice();
    const topWhere  = wOrders.clause.replace(/order_date/g, 'o.order_date');

    // ===== تجميع حسب period =====
    const labelFor = (aliasCol, p) => {
      switch (p) {
        case 'daily':   return `TO_CHAR(${aliasCol}, 'YYYY-MM-DD')`;
        case 'weekly':  return `TO_CHAR(${aliasCol}, 'IYYY-"W"IW')`;
        case 'monthly': return `TO_CHAR(${aliasCol}, 'YYYY-MM')`;
        case 'yearly':  return `TO_CHAR(${aliasCol}, 'YYYY')`;
        default:        return `TO_CHAR(${aliasCol}, 'YYYY-MM')`;
      }
    };
    const limitFor = (p, def) => {
      if (p === 'daily') return 'LIMIT 30';
      if (p === 'weekly') return 'LIMIT 10';
      if (p === 'monthly') return 'LIMIT 12';
      if (p === 'yearly') return '';
      return def || '';
    };

    const salesByParams = [];
    const salesByWhereParts = [`o.status = 'delivered'`];
    if (start) { salesByParams.push(start); salesByWhereParts.push(`o.order_date >= $${salesByParams.length}`); }
    if (end)   { salesByParams.push(end);   salesByWhereParts.push(`o.order_date <= $${salesByParams.length}`); }
    const salesByWhere = `WHERE ${salesByWhereParts.join(' AND ')}`;
    const salesLabel = labelFor('o.order_date', period);
    const salesExtra = limitFor(period, 'LIMIT 12');

    const ordersByParams = [];
    const ordersByWhereParts = [];
    if (start) { ordersByParams.push(start); ordersByWhereParts.push(`o.order_date >= $${ordersByParams.length}`); }
    if (end)   { ordersByParams.push(end);   ordersByWhereParts.push(`o.order_date <= $${ordersByParams.length}`); }
    const ordersByWhere = ordersByWhereParts.length ? `WHERE ${ordersByWhereParts.join(' AND ')}` : '';
    const ordersLabel = labelFor('o.order_date', period);
    const ordersExtra = limitFor(period, 'LIMIT 30');

    const [
      totalSalesResult,
      vendorCountResult,
      customerCountResult,
      productCountResult,
      orderCountResult,
      returnCountResult,
      commissionResult,
      topVendorsResult,
      topProductsResult,
      salesByPeriodResult,
      ordersByPeriodResult
    ] = await Promise.all([
      db.query(`
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM orders
        ${salesWhere};
      `, salesParams),

      db.query(`
        SELECT COUNT(*) AS count
        FROM vendors
        ${wVendors.clause};
      `, wVendors.params),

      db.query(`
        SELECT COUNT(*) AS count
        FROM users
        ${wUsers.clause ? `${wUsers.clause} AND` : 'WHERE'} role = 'customer';
      `, wUsers.params),

      db.query(`
        SELECT COUNT(*) AS count
        FROM products
        ${wProducts.clause};
      `, wProducts.params),

      db.query(`
        SELECT COUNT(*) AS count
        FROM orders
        ${wOrders.clause};
      `, wOrders.params),

      db.query(`
        SELECT COUNT(*) AS count
        FROM returns
        ${wReturns.clause};
      `, wReturns.params),

      db.query(`
        SELECT COALESCE(SUM(vc.commission_amount), 0) AS total
        FROM vendor_commissions vc
        JOIN order_items oi ON vc.order_item_id = oi.id
        JOIN orders o ON oi.order_id = o.id
        ${commissionWhere};
      `, commissionParams),

      db.query(`
        SELECT v.store_name,
               COALESCE(SUM(oi.quantity * oi.price_at_order), 0) AS sales
        FROM order_items oi
        JOIN vendors v ON oi.vendor_id = v.id
        JOIN orders o ON oi.order_id = o.id
        ${topWhere}
        GROUP BY v.id
        ORDER BY sales DESC
        LIMIT 5;
      `, topParams),

      db.query(`
        SELECT p.name,
               COALESCE(SUM(oi.quantity), 0) AS quantity_sold
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        ${topWhere}
        GROUP BY p.id
        ORDER BY quantity_sold DESC
        LIMIT 5;
      `, topParams),

      db.query(`
        SELECT ${salesLabel} AS label,
               COALESCE(SUM(o.total_amount), 0) AS total
        FROM orders o
        ${salesByWhere}
        GROUP BY ${salesLabel}
        ORDER BY MIN(o.order_date) DESC
        ${salesExtra};
      `, salesByParams),

      db.query(`
        SELECT ${ordersLabel} AS label,
               COUNT(*) AS count
        FROM orders o
        ${ordersByWhere}
        GROUP BY ${ordersLabel}
        ORDER BY MIN(o.order_date) DESC
        ${ordersExtra};
      `, ordersByParams),
    ]);

    res.json({
      // أرقام الكروت ضمن النطاق
      totalSales: parseFloat(totalSalesResult.rows[0].total),
      totalRevenue: parseFloat(commissionResult.rows[0].total), // إيراد المنصة = مجموع العمولات
      vendorCount: parseInt(vendorCountResult.rows[0].count),
      customerCount: parseInt(customerCountResult.rows[0].count),
      productCount: parseInt(productCountResult.rows[0].count),
      orderCount: parseInt(orderCountResult.rows[0].count),
      returnCount: parseInt(returnCountResult.rows[0].count),

      // القوائم
      commissionTotal: parseFloat(commissionResult.rows[0].total),
      topVendors: topVendorsResult.rows.map(r => ({ store_name: r.store_name, sales: parseFloat(r.sales) })),
      topProducts: topProductsResult.rows.map(r => ({ name: r.name, quantity_sold: parseInt(r.quantity_sold) })),

      // سلاسل زمنية ضمن النطاق
      salesByMonth: salesByPeriodResult.rows.map(r => ({ label: r.label, total: parseFloat(r.total) })),
      ordersByDay:  ordersByPeriodResult.rows.map(r => ({ label: r.label, count: parseInt(r.count) })),
    });
  } catch (err) {
    console.error('Error building overview:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
