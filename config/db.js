import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let pool = null;

/**
 * Creates or retrieves the MySQL connection pool.
 * Compatible with GoDaddy Hosted MySQL and local development.
 */
export const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'solemission',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      dateStrings: true,
    });
  }
  return pool;
};

/**
 * Automatically initializes database tables if they do not already exist.
 * Matches all fields from previous User, Quote, and BackupLog models.
 */
export const initDB = async () => {
  const currentPool = getPool();

  // Test connection
  await currentPool.query('SELECT 1');

  // 1. Create users table
  await currentPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) DEFAULT 'Admin',
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin',
      avatar TEXT,
      resetPasswordOtp VARCHAR(255) DEFAULT NULL,
      resetPasswordOtpExpires DATETIME DEFAULT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_users_email (email),
      INDEX idx_users_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. Create quotes table
  await currentPool.query(`
    CREATE TABLE IF NOT EXISTS quotes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reference VARCHAR(100) NOT NULL UNIQUE,
      brand VARCHAR(255) NOT NULL,
      model VARCHAR(255) NOT NULL,
      isSuede TINYINT(1) DEFAULT 0,
      \`condition\` VARCHAR(50) NOT NULL,
      services JSON NOT NULL,
      addOns JSON,
      photos JSON,
      turnaround VARCHAR(50) DEFAULT 'standard',
      fulfillment VARCHAR(50) DEFAULT 'dropoff',
      contact JSON NOT NULL,
      agreed TINYINT(1) NOT NULL DEFAULT 1,
      estimate JSON,
      tierId VARCHAR(100) DEFAULT NULL,
      autoFlags JSON,
      status VARCHAR(50) DEFAULT 'pending',
      adminNotes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_quotes_reference (reference),
      INDEX idx_quotes_status (status),
      INDEX idx_quotes_condition (\`condition\`),
      INDEX idx_quotes_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Create backup_logs table
  await currentPool.query(`
    CREATE TABLE IF NOT EXISTS backup_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL,
      filename VARCHAR(255) DEFAULT NULL,
      fileSize VARCHAR(100) DEFAULT NULL,
      recordsCount JSON DEFAULT NULL,
      recipient VARCHAR(255) DEFAULT NULL,
      error TEXT DEFAULT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_backup_logs_type (type),
      INDEX idx_backup_logs_status (status),
      INDEX idx_backup_logs_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('MySQL Database and Tables verified/initialized successfully.');
};

/**
 * Connect to MySQL and ensure tables exist.
 */
export const connectDB = async () => {
  const currentPool = getPool();
  await initDB();
  return currentPool;
};

export default connectDB;
