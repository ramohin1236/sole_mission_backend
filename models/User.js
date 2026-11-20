import { getPool } from '../config/db.js';

/**
 * Safely parse JSON strings or return the object if already parsed
 */
const parseJsonField = (val, fallback = null) => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
};

/**
 * Format raw MySQL user row to match MongoDB document shape for frontend compatibility
 */
export const formatUser = (row) => {
  if (!row) return null;

  const user = {
    ...row,
    _id: String(row.id),
    id: row.id,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
  };

  // Add save method so controllers can update instances seamlessly
  user.save = async function () {
    const pool = getPool();
    await pool.query(
      `UPDATE users 
       SET name = ?, password = ?, role = ?, avatar = ?, resetPasswordOtp = ?, resetPasswordOtpExpires = ?
       WHERE id = ?`,
      [
        this.name || 'Admin',
        this.password,
        this.role || 'admin',
        this.avatar || '',
        this.resetPasswordOtp || null,
        this.resetPasswordOtpExpires ? new Date(this.resetPasswordOtpExpires) : null,
        this.id,
      ]
    );
    return this;
  };

  return user;
};

class UserModel {
  /**
   * Find single user by filter (e.g. { email })
   */
  async findOne(filter = {}) {
    const pool = getPool();
    if (filter.email) {
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
        [filter.email.trim()]
      );
      return rows.length > 0 ? formatUser(rows[0]) : null;
    }
    if (filter.id || filter._id) {
      const id = filter.id || filter._id;
      return this.findById(id);
    }
    return null;
  }

  /**
   * Find single user by ID
   */
  async findById(id) {
    if (!id || isNaN(Number(id))) return null;
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [Number(id)]);
    return rows.length > 0 ? formatUser(rows[0]) : null;
  }

  /**
   * Count total users or count by role
   */
  async countDocuments(filter = {}) {
    const pool = getPool();
    if (filter.role) {
      const [rows] = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = ?', [filter.role]);
      return Number(rows[0]?.count || 0);
    }
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM users');
    return Number(rows[0]?.count || 0);
  }

  /**
   * Create a new user
   */
  async create({ name, email, password, role = 'admin', avatar = '' }) {
    const pool = getPool();
    const normalizedEmail = email.trim().toLowerCase();
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?)',
      [name || 'Admin', normalizedEmail, password, role, avatar]
    );

    return this.findById(result.insertId);
  }

  /**
   * Fetch all users
   */
  find(filter = {}) {
    const pool = getPool();
    let queryPromise = pool.query(
      'SELECT id, name, email, role, avatar, createdAt, updatedAt FROM users ORDER BY createdAt DESC'
    );

    // Provide query builder chain support for `.select().sort().lean()`
    const chain = {
      select() {
        return chain;
      },
      sort() {
        return chain;
      },
      lean() {
        return chain;
      },
      then(resolve, reject) {
        return queryPromise
          .then(([rows]) => resolve(rows.map(formatUser)))
          .catch(reject);
      },
      catch(reject) {
        return queryPromise.catch(reject);
      },
    };

    return chain;
  }

  /**
   * Delete user by ID
   */
  async findByIdAndDelete(id) {
    if (!id || isNaN(Number(id))) return null;
    const user = await this.findById(id);
    if (!user) return null;

    const pool = getPool();
    await pool.query('DELETE FROM users WHERE id = ?', [Number(id)]);
    return user;
  }
}

const User = new UserModel();
export default User;
