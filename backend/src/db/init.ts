import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

// Database connection pool
let pool: Pool | null = null;

/**
 * Get or create the database connection pool
 * Uses DATABASE_URL environment variable (automatically set by Railway)
 */
export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      logger.error('database_url_missing', {
        message: 'DATABASE_URL environment variable is not set'
      });
      throw new Error('DATABASE_URL is required for database connection');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false // Railway uses self-signed certs
      } : false,
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Connection timeout 10 seconds
    });

    // Log pool errors
    pool.on('error', (err: Error) => {
      logger.error('database_pool_error', { error: String(err) });
    });

    logger.info('database_pool_created', {
      max_connections: 10,
      environment: process.env.NODE_ENV,
    });
  }

  return pool;
}

/**
 * Initialize the database by creating tables from schema.sql
 * This should be called on server startup
 */
export async function initializeDatabase(): Promise<void> {
  logger.info('database_initialization_started');

  try {
    const pool = getPool();

    // Test connection
    const client: PoolClient = await pool.connect();
    logger.info('database_connection_established');

    try {
      // Read and execute main schema file (handoffs table)
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await client.query(schema);

      logger.info('database_schema_applied', {
        schema_file: 'schema.sql',
      });

      // Read and execute analytics schema file (analytics_events table)
      const analyticsSchemaPath = path.join(__dirname, 'analytics-schema.sql');
      const analyticsSchema = fs.readFileSync(analyticsSchemaPath, 'utf-8');
      await client.query(analyticsSchema);

      logger.info('database_analytics_schema_applied', {
        schema_file: 'analytics-schema.sql',
      });

      // Verify both tables exist
      const handoffsCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'handoffs'
        );
      `);

      const analyticsCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'analytics_events'
        );
      `);

      const handoffsExists = handoffsCheck.rows[0].exists;
      const analyticsExists = analyticsCheck.rows[0].exists;

      logger.info('database_initialization_complete', {
        handoffs_table_exists: handoffsExists,
        analytics_events_table_exists: analyticsExists,
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('database_initialization_failed', {
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Don't throw in production - allow server to start even if DB fails
    // This allows Railway deployment to succeed and we can debug from logs
    if (process.env.NODE_ENV === 'production') {
      logger.warn('database_initialization_skipped', {
        message: 'Server starting without database - check DATABASE_URL',
      });
    } else {
      throw error;
    }
  }
}

/**
 * Close the database pool (for graceful shutdown)
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('database_pool_closed');
  }
}

/**
 * Check if database is healthy
 * Useful for health check endpoints
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT NOW()');
    return result.rows.length > 0;
  } catch (error) {
    logger.error('database_health_check_failed', { error: String(error) });
    return false;
  }
}
