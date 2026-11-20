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
 * Format raw MySQL quote row to match MongoDB document shape for frontend compatibility
 */
export const formatQuote = (row) => {
  if (!row) return null;

  return {
    ...row,
    _id: String(row.id),
    id: row.id,
    isSuede: Boolean(row.isSuede),
    agreed: Boolean(row.agreed),
    services: parseJsonField(row.services, []),
    addOns: parseJsonField(row.addOns, []),
    photos: parseJsonField(row.photos, {}),
    contact: parseJsonField(row.contact, {}),
    estimate: parseJsonField(row.estimate, {}),
    autoFlags: parseJsonField(row.autoFlags, []),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
  };
};

class QuoteModel {
  /**
   * Create a new quote record
   */
  async create(data) {
    const pool = getPool();
    const {
      reference,
      brand,
      model,
      isSuede = false,
      condition,
      services = [],
      addOns = [],
      photos = {},
      turnaround = 'standard',
      fulfillment = 'dropoff',
      contact = {},
      agreed = true,
      estimate = {},
      tierId = null,
      autoFlags = [],
      status = 'pending',
      adminNotes = '',
    } = data;

    const [result] = await pool.query(
      `INSERT INTO quotes 
       (reference, brand, model, isSuede, \`condition\`, services, addOns, photos, turnaround, fulfillment, contact, agreed, estimate, tierId, autoFlags, status, adminNotes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        brand?.trim() || '',
        model?.trim() || '',
        isSuede ? 1 : 0,
        condition,
        JSON.stringify(services),
        JSON.stringify(addOns),
        JSON.stringify(photos),
        turnaround,
        fulfillment,
        JSON.stringify(contact),
        agreed ? 1 : 0,
        JSON.stringify(estimate),
        tierId,
        JSON.stringify(autoFlags),
        status,
        adminNotes,
      ]
    );

    return this.findById(result.insertId);
  }

  /**
   * Find single quote by ID
   */
  async findById(id) {
    if (!id || isNaN(Number(id))) return null;
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM quotes WHERE id = ? LIMIT 1', [Number(id)]);
    return rows.length > 0 ? formatQuote(rows[0]) : null;
  }

  /**
   * Find single quote by filter (e.g. { reference: 'SM-...' })
   */
  async findOne(filter = {}) {
    const pool = getPool();
    if (filter.reference) {
      const [rows] = await pool.query('SELECT * FROM quotes WHERE reference = ? LIMIT 1', [filter.reference]);
      return rows.length > 0 ? formatQuote(rows[0]) : null;
    }
    if (filter._id || filter.id) {
      return this.findById(filter._id || filter.id);
    }
    return null;
  }

  /**
   * Count documents matching optional filter
   */
  async countDocuments(filter = {}) {
    const pool = getPool();
    const { whereClause, params } = this._buildWhereClause(filter);
    const sql = `SELECT COUNT(*) as count FROM quotes ${whereClause}`;
    const [rows] = await pool.query(sql, params);
    return Number(rows[0]?.count || 0);
  }

  /**
   * Query multiple quotes with chainable sort, skip, limit, lean
   */
  find(filter = {}) {
    const pool = getPool();
    const { whereClause, params } = this._buildWhereClause(filter);

    let orderBy = 'ORDER BY createdAt DESC';
    let limitClause = '';
    const queryParams = [...params];

    const chain = {
      sort(sortOpt) {
        if (sortOpt && typeof sortOpt === 'object') {
          const [field, dir] = Object.entries(sortOpt)[0] || ['createdAt', -1];
          const direction = dir === 1 || dir === 'asc' ? 'ASC' : 'DESC';
          const validFields = ['id', 'createdAt', 'updatedAt', 'reference', 'status', 'brand'];
          if (validFields.includes(field)) {
            orderBy = `ORDER BY ${field} ${direction}`;
          }
        }
        return chain;
      },
      skip(offset) {
        chain._offset = Math.max(0, parseInt(offset, 10));
        return chain;
      },
      limit(lim) {
        chain._limit = Math.max(1, parseInt(lim, 10));
        return chain;
      },
      lean() {
        return chain;
      },
      async then(resolve, reject) {
        try {
          let sql = `SELECT * FROM quotes ${whereClause} ${orderBy}`;
          const currentParams = [...queryParams];

          if (chain._limit !== undefined) {
            sql += ' LIMIT ?';
            currentParams.push(chain._limit);
            if (chain._offset !== undefined) {
              sql += ' OFFSET ?';
              currentParams.push(chain._offset);
            }
          }

          const [rows] = await pool.query(sql, currentParams);
          resolve(rows.map(formatQuote));
        } catch (err) {
          reject(err);
        }
      },
      catch(reject) {
        return chain.then((res) => res).catch(reject);
      },
    };

    return chain;
  }

  /**
   * Find quote by ID and delete
   */
  async findByIdAndDelete(id) {
    if (!id || isNaN(Number(id))) return null;
    const quote = await this.findById(id);
    if (!quote) return null;

    const pool = getPool();
    await pool.query('DELETE FROM quotes WHERE id = ?', [Number(id)]);
    return quote;
  }

  /**
   * Find quote by filter and delete
   */
  async findOneAndDelete(filter = {}) {
    const quote = await this.findOne(filter);
    if (!quote) return null;

    const pool = getPool();
    await pool.query('DELETE FROM quotes WHERE id = ?', [quote.id]);
    return quote;
  }

  /**
   * Find quote and update fields
   */
  async findOneAndUpdate(filter = {}, update = {}, options = {}) {
    const quote = await this.findOne(filter);
    if (!quote) return null;

    const pool = getPool();
    const updateData = update.$set || update;
    const fields = [];
    const params = [];

    if (updateData.status !== undefined) {
      fields.push('status = ?');
      params.push(updateData.status);
    }
    if (updateData.adminNotes !== undefined) {
      fields.push('adminNotes = ?');
      params.push(updateData.adminNotes);
    }
    if (updateData.estimate !== undefined) {
      fields.push('estimate = ?');
      params.push(JSON.stringify(updateData.estimate));
    }

    if (fields.length > 0) {
      params.push(quote.id);
      const sql = `UPDATE quotes SET ${fields.join(', ')} WHERE id = ?`;
      await pool.query(sql, params);
    }

    return this.findById(quote.id);
  }

  /**
   * Helper: Build WHERE clause from query filters
   */
  _buildWhereClause(filter) {
    const conditions = [];
    const params = [];

    if (filter.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }

    if (filter.condition) {
      conditions.push('`condition` = ?');
      params.push(filter.condition);
    }

    if (filter.reference) {
      conditions.push('reference = ?');
      params.push(filter.reference);
    }

    if (filter.$or && Array.isArray(filter.$or)) {
      const orConditions = [];
      for (const item of filter.$or) {
        if (item.reference instanceof RegExp) {
          orConditions.push('reference LIKE ?');
          params.push(`%${item.reference.source}%`);
        } else if (item['contact.fullName'] instanceof RegExp) {
          orConditions.push("JSON_UNQUOTE(JSON_EXTRACT(contact, '$.fullName')) LIKE ?");
          params.push(`%${item['contact.fullName'].source}%`);
        } else if (item['contact.email'] instanceof RegExp) {
          orConditions.push("JSON_UNQUOTE(JSON_EXTRACT(contact, '$.email')) LIKE ?");
          params.push(`%${item['contact.email'].source}%`);
        } else if (item['contact.phone'] instanceof RegExp) {
          orConditions.push("JSON_UNQUOTE(JSON_EXTRACT(contact, '$.phone')) LIKE ?");
          params.push(`%${item['contact.phone'].source}%`);
        }
      }
      if (orConditions.length > 0) {
        conditions.push(`(${orConditions.join(' OR ')})`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  }
}

const Quote = new QuoteModel();
export default Quote;
