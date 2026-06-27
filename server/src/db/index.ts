import { Pool } from 'pg'
import '../config/env'

const dbUrl = process.env.DATABASE_URL || ''
// Cloud Postgres (Neon, Supabase, Render…) requires TLS; local Docker on
// localhost does not. Decide from the host rather than NODE_ENV so the same
// config works in dev and production.
const isLocalDb = /@(localhost|127\.0\.0\.1|\[::1\])/.test(dbUrl)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Neon free tier can cold-start (scale-to-zero)
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle DB client', err)
  process.exit(-1)
})

export const query = (text: string, params?: unknown[]) =>
  pool.query(text, params)

export const getClient = () => pool.connect()

export default pool
