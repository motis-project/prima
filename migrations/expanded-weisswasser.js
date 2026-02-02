import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { sql } from 'kysely'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function up(db) {
  const zoneSql = fs.readFileSync(
    path.join(__dirname, '../data/expandWeißwasser.sql'),
    'utf8'
  )

  await sql.raw(zoneSql).execute(db)
}

export async function down() {}
