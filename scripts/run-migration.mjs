// One-off runner for supabase/migrations/*.sql against the real Postgres
// instance the Vercel Supabase integration provisioned. Uses
// POSTGRES_URL_NON_POOLING (not the pooler) since DDL/transactional
// statements need a direct session, not pgbouncer's transaction-mode pool.
// `pg` is a dev-time-only tool here — installed with --no-save, not a
// runtime dependency of the app itself (the app only ever talks to
// Supabase via @supabase/supabase-js + the anon key, never a direct
// Postgres connection or the service-role key).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')

// Minimal .env.local parser — avoids adding dotenv as a real dependency
// for a script that's meant to be deleted after use.
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      const key = l.slice(0, i).trim()
      const value = l.slice(i + 1).trim().replace(/^"|"$/g, '')
      return [key, value]
    }),
)

const migrationFile = process.argv[2]
if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.mjs <path-to-sql-file>')
  process.exit(1)
}

const sql = readFileSync(migrationFile, 'utf8')

// The connection string's own `sslmode=require` query param gets parsed by
// pg-connection-string into an SSL config that overrides an explicit `ssl`
// option passed alongside it — stripping it here so the explicit
// rejectUnauthorized:false below is what actually takes effect, instead of
// silently being ignored (confirmed: passing both left the original
// self-signed-cert failure unchanged).
const connectionString = env.POSTGRES_URL_NON_POOLING.replace(/[?&]sslmode=[^&]*/, '')

// rejectUnauthorized: false — the connection itself is still TLS-encrypted;
// this only skips full CA-chain verification against Node's local trust
// store, which doesn't have Supabase's issuing CA in this environment.
// Standard workaround for a one-off direct-pg-driver connection to
// Supabase. The app itself never does this — it only ever talks to
// Supabase via @supabase/supabase-js over HTTPS, not a raw Postgres
// connection.
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  await client.query(sql)
  console.log(`[run-migration] applied ${migrationFile} successfully`)
} catch (err) {
  console.error('[run-migration] FAILED:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
