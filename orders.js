// db/orders.js - دوال الطلبات، عناصر الطلب، الإرجاع، الشحن، والدفعات

// سيتم استيراد pool من db/index.js لاحقًا
// db/orders.js
const { pool } = require('./connection');
const bcrypt = require('bcryptjs');
// --- دوال الطلبات ---
async function createOrderFromCart(userId, shippingAddress) {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // جلب عناصر السلة مع بيانات المنتج والبائع
    const cartResult = await client.query(`
      SELECT 
        ci.product_id, 
        ci.quantity, 
        p.price, 
        p.stock,
        p.vendor_id
      FROM carts c
      JOIN cart_items ci ON c.id = ci.cart_id
      JOIN products p ON ci.product_id = p.id
      WHERE c.user_id = $1;
    `, [userId]);
    if (cartResult.rows.length === 0) {
      throw new Error('Cart is empty.');
    }
    let totalAmount = 0;
    let orderItems = [];
    for (const item of cartResult.rows) {
      if (item.quantity > item.stock) {
        throw new Error(`Not enough stock for product ID ${item.product_id}.`);
      }
      // جلب بيانات البائع (بما في ذلك country)
      const vendorRes = await client.query(`
        SELECT id, country FROM vendors WHERE user_id = $1
      `, [item.vendor_id]);
      const vendor = vendorRes.rows[0];
      if (!vendor) {
        throw new Error(`Vendor not found for product ID ${item.product_id}`);
      }
      // --- حساب الضريبة ---
      let taxRate = 0;
      let taxAmount = 0;
      if (vendor.country) {
        const taxRes = await client.query(`
          SELECT tax_rate FROM tax_rates 
          WHERE country = $1 AND is_active = TRUE
        `, [vendor.country]);
        taxRate = taxRes.rows[0]?.tax_rate || 0;
      }
      const itemSubtotal = item.price * item.quantity;
      taxAmount = itemSubtotal * (taxRate / 100);
      // --- التحقق من اشتراك البائع ---
      const subRes = await client.query(`
        SELECT * FROM subscriptions 
        WHERE vendor_id = $1 
          AND status = 'active' 
          AND (end_date IS NULL OR end_date > NOW())
      `, [vendor.id]);
      const isSubscribed = subRes.rows.length > 0;
      let feeAmount = 0;
      if (!isSubscribed) {
        const feeRes = await client.query(`
          SELECT fee_type, fee_value FROM vendor_fees 
          WHERE vendor_id = $1 AND is_active = TRUE
        `, [vendor.id]);
        const fee = feeRes.rows[0];
        if (fee) {
          feeAmount = fee.fee_type === 'percentage'
            ? itemSubtotal * (fee.fee_value / 100)
            : fee.fee_value;
        }
      }
      // --- حساب السعر الكلي مع الضريبة ---
      const itemTotalWithTax = itemSubtotal + taxAmount;
      totalAmount += itemTotalWithTax;
      // --- إنشاء الطلب ---
      const orderRes = await client.query(
        `INSERT INTO orders(user_id, shipping_address, total_amount, status) 
         VALUES($1, $2, $3, 'pending') RETURNING id;`,
        [userId, shippingAddress, totalAmount]
      );
      const orderId = orderRes.rows[0].id;
      // --- إدراج عنصر الطلب ---
      const orderItemRes = await client.query(`
        INSERT INTO order_items(order_id, product_id, quantity, price_at_order, vendor_id) 
        VALUES($1, $2, $3, $4, $5) RETURNING id;
      `, [orderId, item.product_id, item.quantity, item.price, vendor.id]);
      const orderItemId = orderItemRes.rows[0].id;
      // --- تسجيل التفاصيل في vendor_commissions ---
      await client.query(`
        INSERT INTO vendor_commissions(
          order_item_id, 
          vendor_id, 
          product_price, 
          commission_rate, 
          commission_amount,
          tax_amount,
          fee_amount,
          is_fee_waived,
          status
        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, 'pending');
      `, [
        orderItemId,
        vendor.id,
        item.price,
        10.00, // يمكنك استبدالها بـ vendor.commission_rate لاحقًا
        feeAmount,
        taxAmount,
        feeAmount,
        isSubscribed,
      ]);
      // --- تحديث المخزون ---
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2;', [item.quantity, item.product_id]);
      orderItems.push({
        productId: item.product_id,
        quantity: item.quantity,
        price: item.price,
        taxRate,
        taxAmount,
        feeAmount,
        isFeeWaived: isSubscribed,
        vendorId: vendor.id
      });
    }
    // --- مسح السلة ---
    await client.query('DELETE FROM cart_items USING carts WHERE carts.user_id = $1 AND cart_items.cart_id = carts.id;', [userId]);
    await client.query('COMMIT');
    return {
      id: orderId,
      total_amount: totalAmount,
      items: orderItems
    };
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Error creating order:', err);
    throw err;
  } finally {
    if (client) client.release();
  }
}

async function getOrderDetails(orderId) {
  let client;
  try {
    client = await pool.connect();
    const orderRes = await client.query(`
      SELECT id, user_id, order_date, total_amount, status, payment_method, payment_status, shipping_address, billing_address, created_at
      FROM orders WHERE id = $1;
    `, [orderId]);
    const order = orderRes.rows[0];
    if (!order) return null;
    const itemsRes = await client.query(`
      SELECT oi.product_id, oi.quantity, oi.price_at_order, p.name AS product_name, p.vendor_id
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1;
    `, [order.id]);
    order.items = itemsRes.rows;
    return order;
  } catch (err) {
    console.error('Error getting order details:', err.stack);
    throw err;
  } finally {
    if (client) client.release();
  }
}

async function getOrdersByUserId(userId) {
  const res = await pool.query(`
    SELECT id, user_id, order_date, total_amount, status, shipping_address, created_at
    FROM orders WHERE user_id = $1 ORDER BY order_date DESC;
  `, [userId]);
  return res.rows;
}

async function updateOrderStatus(orderId, newStatus) {
  const res = await pool.query(
    `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, status, updated_at;`,
    [newStatus, orderId]
  );
  return res.rows[0];
}

async function getOrdersByVendorId(vendorId) {
  const res = await pool.query(`
    SELECT 
      o.id, o.user_id, o.order_date, o.total_amount, o.status, o.shipping_address, o.created_at,
      oi.product_id, oi.quantity, oi.price_at_order,
      p.name AS product_name, p.image_url
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE p.vendor_id = $1
    ORDER BY o.created_at DESC;
  `, [vendorId]);
  return res.rows;
}

async function isOrderForVendor(orderId, vendorId) {
  const res = await pool.query(`
    SELECT 1 FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = $1 AND p.vendor_id = $2 LIMIT 1;
  `, [orderId, vendorId]);
  return res.rows.length > 0;
}

// --- دوال طلبات الإرجاع ---
async function requestReturn(orderItemId, userId, reason, images = []) {
  const res = await pool.query(`
    INSERT INTO returns (order_item_id, user_id, reason, images)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `, [orderItemId, userId, reason, JSON.stringify(images)]);
  return res.rows[0];
}

async function getAllReturns() {
  try {
    const res = await pool.query(`
      SELECT r.*, u.name as customer_name, u.email as customer_email, p.name as product_name
      FROM returns r
      JOIN users u ON r.user_id = u.id
      JOIN order_items oi ON r.order_item_id = oi.id
      JOIN products p ON oi.product_id = p.id
      ORDER BY r.created_at DESC;
    `);
    return res.rows;
  } catch (err) {
    console.error('Error fetching returns:', err);
    return [];
  }
}

// --- دوال وسائل الشحن ---
async function insertShippingMethod(name, cost, estimatedDays, isActive = true) {
  try {
    const res = await pool.query(`
      INSERT INTO shipping_methods (name, cost, estimated_days, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `, [name, cost, estimatedDays, isActive]);
    return res.rows[0];
  } catch (err) {
    console.error('Error inserting shipping method:', err);
    throw err;
  }
}

// --- دوال الدفعات (Payouts) ---
async function getAllPayouts() {
  try {
    const res = await pool.query(`
      SELECT p.*, u.name as vendor_name
      FROM payouts p
      JOIN users u ON p.vendor_id = u.id
      ORDER BY p.created_at DESC
    `);
    return res.rows;
  } catch (err) {
    console.error('Error fetching payouts:', err);
    return [];
  }
}

// --- دوال الطلبات (للوحة التحكم) ---
async function getAllOrders() {
  try {
    const res = await pool.query(`
      SELECT o.*, u.name AS customer_name, u.email AS customer_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.order_date DESC
    `);
    return res.rows;
  } catch (err) {
    console.error('Error fetching all orders:', err);
    throw err;
  }
}

module.exports = {
  createOrderFromCart,
  getOrderDetails,
  getOrdersByUserId,
  updateOrderStatus,
  getOrdersByVendorId,
  isOrderForVendor,
  requestReturn,
  getAllReturns,
  insertShippingMethod,
  getAllPayouts,
  getAllOrders,
};