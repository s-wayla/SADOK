// models/userModel.js
const db = require('../db'); // يستعمل db.query الموجود عندك

module.exports = {
  async getByEmail(email) {
    const q = `SELECT id, name, email, password, role, created_at FROM users WHERE email = $1 LIMIT 1`;
    const { rows } = await db.query(q, [email]);
    return rows[0] || null;
  },

  async getById(id) {
    const q = `SELECT id, name, email, password, role, created_at FROM users WHERE id = $1 LIMIT 1`;
    const { rows } = await db.query(q, [id]);
    return rows[0] || null;
  },

  async createUser({ name, email, passwordHash, role }) {
    const q = `
      INSERT INTO users(name, email, password, role)
      VALUES($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at
    `;
    const { rows } = await db.query(q, [name, email, passwordHash, role]);
    return rows[0];
  }
};
