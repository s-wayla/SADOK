// db/cart.js - دوال إدارة السلة وعناصر السلة

// سيتم استيراد pool من db/index.js لاحقًا
// db/cart.js
const { pool } = require('./connection');
const bcrypt = require('bcryptjs');
// --- دوال السلات ---
async function getOrCreateCart(userId) {
  let client;
  try {
    client = await pool.connect();
    let res = await client.query('SELECT id FROM carts WHERE user_id = $1;', [userId]);
    let cart = res.rows[0];
    if (!cart) {
      res = await client.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id;', [userId]);
      cart = res.rows[0];
    }
    return cart;
  } catch (err) {
    console.error('Error getting or creating cart:', err.stack);
    throw err;
  } finally {
    if (client) client.release();
  }
}

async function addProductToCart(cartId, productId, quantity) {
  let client;
  try {
    client = await pool.connect();
    const res = await client.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, product_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
       RETURNING *;`,
      [cartId, productId, quantity]
    );
    return res.rows[0];
  } catch (err) {
    console.error('Error adding product to cart:', err.stack);
    throw err;
  } finally {
    if (client) client.release();
  }
}

async function updateCartItemQuantity(cartItemId, quantity) {
  let client;
  try {
    client = await pool.connect();
    if (quantity <= 0) {
      const res = await client.query('DELETE FROM cart_items WHERE id = $1 RETURNING id;', [cartItemId]);
      return res.rows[0] ? { message: 'removed' } : null;
    } else {
      const res = await client.query(
        'UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;',
        [quantity, cartItemId]
      );
      return res.rows[0];
    }
  } catch (err) {
    console.error('Error updating cart item:', err.stack);
    throw err;
  } finally {
    if (client) client.release();
  }
}

async function removeProductFromCart(cartItemId) {
  let client;
  try {
    client = await pool.connect();
    const res = await client.query('DELETE FROM cart_items WHERE id = $1 RETURNING id;', [cartItemId]);
    return res.rows[0];
  } catch (err) {
    console.error('Error removing from cart:', err.stack);
    throw err;
  } finally {
    if (client) client.release();
  }
}

async function getCartByUserId(userId) {
  let client;
  try {
    client = await pool.connect();
    const cart = await getOrCreateCart(userId);
    const itemsRes = await client.query(`
      SELECT ci.id AS cart_item_id, ci.product_id, ci.quantity, p.name, p.price, p.image_url
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = $1;
    `, [cart.id]);
    const total_price = itemsRes.rows.reduce((sum, item) => {
      const price = parseFloat(item.price) || 0;
      return sum + (price * item.quantity);
    }, 0);
    return { cart_id: cart.id, items: itemsRes.rows, total_price: total_price.toFixed(2) };
  } catch (err) {
    console.error('Error getting cart:', err.stack);
    throw err;
  } finally {
    if (client) client.release();
  }
}

async function clearCart(cartId) {
  let client;
  try {
    client = await pool.connect();
    const res = await client.query('DELETE FROM cart_items WHERE cart_id = $1;', [cartId]);
    return res.rowCount;
  } catch (err) {
    console.error('Error clearing cart:', err.stack);
    throw err;
  } finally {
    if (client) client.release();
  }
}

module.exports = {
  getOrCreateCart,
  addProductToCart,
  updateCartItemQuantity,
  removeProductFromCart,
  getCartByUserId,
  clearCart,
};