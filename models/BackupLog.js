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
 * Format raw MySQL backup log row to match MongoDB document shape for frontend compatibility
 */
export const formatBackupLog = (row) => {
  if (!row) return null;

  return {
    ...row,
    _id: String(row.id),
    id: row.id,
    recordsCount: parseJsonField(row.recordsCount, { quotes: 0, users: 0 }),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
  };
};

class BackupLogModel {
  /**
   * Create a new backup log entry
   */
  async create(data) {
    const pool = getPool();
    const {
      type,
      status,
      filename = null,
      fileSize = null,
      recordsCount = null,
      recipient = null,
      error = null,
      createdAt = new Date(),
    } = data;

    const formattedCreatedAt = createdAt instanceof Date ? createdAt : new Date(createdAt);

    const [result] = await pool.query(
      `INSERT INTO backup_logs (type, status, filename, fileSize, recordsCount, recipient, error, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        type,
        status,
        filename,
        fileSize,
        recordsCount ? JSON.stringify(recordsCount) : null,
        recipient,
        error,
        formattedCreatedAt,
      ]
    );

    return this.findById(result.insertId);
  }

  /**
   * Find backup log by ID
   */
  async findById(id) {
    if (!id || isNaN(Number(id))) return null;
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM backup_logs WHERE id = ? LIMIT 1', [Number(id)]);
    return rows.length > 0 ? formatBackupLog(rows[0]) : null;
  }

  /**
   * Count total backup logs
   */
  async countDocuments() {
    const pool = getPool();
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM backup_logs');
    return Number(rows[0]?.count || 0);
  }

  /**
   * Fetch backup logs with chainable sort, limit, lean
   */
  find() {
    const pool = getPool();
    let orderBy = 'ORDER BY createdAt DESC';
    let limitNum = 50;

    const chain = {
      sort(sortOpt) {
        return chain;
      },
      limit(n) {
        limitNum = Math.max(1, parseInt(n, 10));
        return chain;
      },
      lean() {
        return chain;
      },
      async then(resolve, reject) {
        try {
          const [rows] = await pool.query(
            `SELECT * FROM backup_logs ${orderBy} LIMIT ?`,
            [limitNum]
          );
          resolve(rows.map(formatBackupLog));
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
}

const BackupLog = new BackupLogModel();
export default BackupLog;
