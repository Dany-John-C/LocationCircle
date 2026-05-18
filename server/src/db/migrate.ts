import { readFileSync } from 'fs'
import { join } from 'path'
import pool from './index'

export async function migrate() {
  const schemaPath = join(__dirname, 'schema.sql')
  const schema = readFileSync(schemaPath, 'utf-8')
  try {
    await pool.query(schema)
    console.log('✅ Database schema applied successfully')
  } catch (err) {
    console.error('❌ Migration failed:', err)
    throw err
  }
}

// Run directly: npx tsx src/db/migrate.ts
if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(() => process.exit(1))
}
