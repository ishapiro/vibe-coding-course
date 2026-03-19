import type { H3Event } from 'h3'
import { createError } from 'h3'

interface D1Result<T = unknown> {
  results?: T[]
  success?: boolean
  meta?: Record<string, any>
}

interface D1PreparedStatement {
  bind (...values: any[]): D1PreparedStatement
  all<T = unknown>(): Promise<D1Result<T>>
  run<T = unknown>(): Promise<D1Result<T>>
}

interface D1Database {
  prepare (query: string): D1PreparedStatement
}

interface CloudflareEnv {
  demo_test_db: D1Database
}

function getDb (event: H3Event): D1Database {
  const env = event.context.cloudflare?.env as CloudflareEnv | undefined

  if (!env?.demo_test_db) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server Error',
      message: 'Database not configured'
    })
  }

  return env.demo_test_db
}

type SettingRow = {
  key: string
  value: string
}

function mapSettingRowToJson (row: SettingRow) {
  return {
    key: row.key,
    value: row.value
  }
}

export default defineEventHandler(async (event) => {
  const db = getDb(event)

  const { results } = await db
    .prepare(
      `
        SELECT key, value
        FROM system_settings
        ORDER BY key ASC
      `
    )
    .all<SettingRow>()

  const items = (results ?? []).map(mapSettingRowToJson)
  const byKey = Object.fromEntries(items.map(item => [item.key, item.value]))

  return {
    items,
    byKey
  }
})

