// db/products.js - دوال المنتجات، الفئات، الأقسام الفرعية، وصور المنتجات

const { pool } = require('./connection');
const bcrypt = require('bcryptjs');

// --- دوال المنتجات ---
async function insertProduct(name, description, price, stock, imageUrl, vendorId, categoryId, subcategoryId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // --- 1. التحقق من وجود اشتراك نشط للبائع ---
    const subscriptionRes = await client.query(`
      SELECT sp.max_products
      FROM vendor_subscriptions vs
      JOIN subscription_plans sp ON vs.plan_id = sp.id
      WHERE vs.vendor_id = $1 AND vs.status = 'active';
    `, [vendorId]);

    if (subscriptionRes.rows.length === 0) {
      throw new Error('لا يمكن إضافة منتج: لا يوجد اشتراك نشط. يرجى الاشتراك في باقة.');
    }

    const maxProducts = subscriptionRes.rows[0].max_products;

    // --- 2. إذا كانت max_products = NULL أو -1 → غير محدود ---
    if (maxProducts !== null && maxProducts > 0) {
      // --- 3. حساب عدد المنتجات الحالية ---
      const countRes = await client.query(`
        SELECT COUNT(*)::int FROM products WHERE vendor_id = $1;
      `, [vendorId]);

      const currentCount = countRes.rows[0].count;

      // --- 4. التحقق من الحد الأقصى ---
      if (currentCount >= maxProducts) {
        throw new Error(`لا يمكن إضافة منتج: لقد وصلت إلى الحد الأقصى من المنتجات (${maxProducts}). يرجى الترقية إلى باقة أعلى.`);
      }
    }

    // --- 5. إضافة المنتج ---
    const result = await client.query(
      `INSERT INTO products (name, description, price, stock, image_url, vendor_id, category_id, subcategory_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, description, price, stock, image_url, vendor_id, category_id, subcategory_id, created_at, updated_at;`,
      [name, description, price, stock, imageUrl, vendorId, categoryId, subcategoryId]
    );

    await client.query('COMMIT');
    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ خطأ في إضافة المنتج:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function getAllProducts() {
  try {
    const result = await pool.query(`
      SELECT 
        p.id, 
        p.name, 
        p.description, 
        p.price, 
        p.stock, 
        p.image_url, 
        p.vendor_id, 
        u.name AS vendor_name, 
        p.category_id, 
        c.name AS category_name, 
        p.subcategory_id,
        s.name AS subcategory_name,
        p.created_at, 
        p.updated_at
      FROM products p
      JOIN users u ON p.vendor_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN subcategories s ON p.subcategory_id = s.id;
    `);
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    throw new Error('Failed to fetch products from the database.');
  }
}

async function getProductById(id) {
  const result = await pool.query(`
    SELECT p.id, p.name, p.description, p.price, p.stock, p.image_url, p.vendor_id, u.name AS vendor_name, 
           p.category_id, c.name AS category_name, 
           p.subcategory_id, s.name AS subcategory_name,
           p.created_at, p.updated_at
    FROM products p
    JOIN users u ON p.vendor_id = u.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN subcategories s ON p.subcategory_id = s.id
    WHERE p.id = $1;
  `, [id]);
  return result.rows[0];
}

async function updateProduct(id, name, description, price, stock, imageUrl, vendorId, categoryId, subcategoryId) {
  const result = await pool.query(
    `UPDATE products
     SET name = $1, description = $2, price = $3, stock = $4, image_url = $5, vendor_id = $6, category_id = $7, subcategory_id = $8, updated_at = CURRENT_TIMESTAMP
     WHERE id = $9
     RETURNING id, name, description, price, stock, image_url, vendor_id, category_id, subcategoryId, created_at, updated_at;`,
    [name, description, price, stock, imageUrl, vendorId, categoryId, subcategoryId, id]
  );
  return result.rows[0];
}

async function deleteProduct(id) {
  let client;
  try {
    client = await pool.connect();
    const res = await client.query('DELETE FROM products WHERE id = $1 RETURNING id, name;', [id]);
    return res.rows[0];
  } catch (err) {
    console.error('Error deleting product:', err.stack);
    throw err;
  } finally {
    if (client) client.release();
  }
}

async function getProductsByVendorId(vendorId) {
  const result = await pool.query(`
    SELECT 
      p.id, 
      p.name, 
      p.description, 
      p.price, 
      p.stock, 
      p.image_url, 
      p.vendor_id, 
      u.name AS vendor_name, 
      p.category_id,
      c.name AS category_name,
      p.subcategory_id,
      s.name AS subcategory_name,
      p.created_at, 
      p.updated_at
    FROM products p
    JOIN users u ON p.vendor_id = u.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN subcategories s ON p.subcategory_id = s.id
    WHERE p.vendor_id = $1;
  `, [vendorId]);
  return result.rows;
}

// --- دالة جديدة: جلب عدد المنتجات للبائع ---
async function getVendorProductCount(vendorId) {
  const result = await pool.query(`
    SELECT COUNT(*)::int FROM products WHERE vendor_id = $1;
  `, [vendorId]);
  return result.rows[0].count;
}

// --- دوال الفئات ---
async function insertCategory(name, description) {
  const result = await pool.query(
    `INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at, updated_at;`,
    [name, description]
  );
  return result.rows[0];
}

async function getAllCategories() {
  const result = await pool.query('SELECT * FROM categories;');
  return result.rows;
}

async function getCategoryById(id) {
  const result = await pool.query('SELECT * FROM categories WHERE id = $1;', [id]);
  return result.rows[0];
}

async function updateCategory(id, name, description) {
  const result = await pool.query(
    `UPDATE categories SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *;`,
    [name, description, id]
  );
  return result.rows[0];
}

async function deleteCategory(id) {
  const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id, name;', [id]);
  return result.rows[0];
}

async function getCategoryByName(name) {
  try {
    const result = await pool.query('SELECT * FROM categories WHERE name = $1;', [name]);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching category by name:', error);
    throw error;
  }
}

// --- دوال الأقسام الفرعية ---
async function insertSubcategory(name, description, categoryId) {
  try {
    const result = await pool.query(
      `INSERT INTO subcategories (name, description, category_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description, categoryId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error inserting subcategory:', error);
    throw error;
  }
}

async function getAllSubcategories() {
  const result = await pool.query('SELECT * FROM subcategories;');
  return result.rows;
}

async function updateSubcategory(id, name, description, categoryId) {
  const result = await pool.query(
    `UPDATE subcategories
     SET name = $1, description = $2, category_id = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [name, description, categoryId, id]
  );
  return result.rows[0];
}

async function getSubcategoriesByCategoryId(categoryId) {
  const result = await pool.query(
    'SELECT * FROM subcategories WHERE category_id = $1;',
    [categoryId]
  );
  return result.rows;
}

async function getSubcategoryByNameAndCategory(name, categoryId) {
  const result = await pool.query(
    'SELECT * FROM subcategories WHERE name = $1 AND category_id = $2;',
    [name, categoryId]
  );
  return result.rows[0];
}

async function getSubcategoryById(id) {
  const result = await pool.query(
    'SELECT * FROM subcategories WHERE id = $1;',
    [id]
  );
  return result.rows[0];
}

async function deleteSubcategory(id) {
  const result = await pool.query(
    'DELETE FROM subcategories WHERE id = $1 RETURNING *;',
    [id]
  );
  return result.rows[0];
}

// --- دوال صور المنتجات ---
async function addProductImage(productId, imageUrl, isPrimary = false) {
  await pool.query('UPDATE product_images SET is_primary = FALSE WHERE product_id = $1 AND is_primary = TRUE;', [productId]);
  const res = await pool.query(`
    INSERT INTO product_images (product_id, image_url, is_primary)
    VALUES ($1, $2, $3)
    RETURNING *;
  `, [productId, imageUrl, isPrimary]);
  return res.rows[0];
}

async function insertReview(productId, userId, rating, comment) {
  const res = await pool.query(`
    INSERT INTO product_reviews (product_id, user_id, rating, comment)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (product_id, user_id) DO UPDATE SET
    rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `, [productId, userId, rating, comment]);
  return res.rows[0];
}

async function getReviewsByProductId(productId) {
  const res = await pool.query(`
    SELECT pr.*, u.name AS user_name FROM product_reviews pr
    JOIN users u ON pr.user_id = u.id
    WHERE pr.product_id = $1 ORDER BY pr.created_at DESC;
  `, [productId]);
  return res.rows;
}

async function getReviewById(reviewId) {
  const res = await pool.query('SELECT * FROM product_reviews WHERE id = $1;', [reviewId]);
  return res.rows[0];
}

async function updateReview(reviewId, rating, comment) {
  const res = await pool.query(
    `UPDATE product_reviews
     SET rating = COALESCE($1, rating), comment = COALESCE($2, comment), updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 RETURNING *;`,
    [rating, comment, reviewId]
  );
  return res.rows[0];
}

async function deleteReview(reviewId) {
  const res = await pool.query('DELETE FROM product_reviews WHERE id = $1 RETURNING *;', [reviewId]);
  return res.rows[0];
}

module.exports = {
  // المنتجات
  insertProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductsByVendorId,
  getVendorProductCount, // ✅ دالة جديدة
  // الفئات
  insertCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryByName,
  // الأقسام الفرعية
  insertSubcategory,
  getAllSubcategories,
  updateSubcategory,
  getSubcategoriesByCategoryId,
  getSubcategoryByNameAndCategory,
  getSubcategoryById,
  deleteSubcategory,
  // صور المنتجات
  addProductImage,
  insertReview,
  getReviewsByProductId,
  getReviewById,
  updateReview,
  deleteReview,
};