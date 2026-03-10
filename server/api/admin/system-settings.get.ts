import type { H3Event } from 'h3'
import { createError } from 'h3'
import { requireAdmin } from '~/server/utils/auth'

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

type SystemSettingRow = {
  key: string
  value: string
}

function mapSystemSettingRowToJson (row: SystemSettingRow) {
  return {
    key: row.key,
    value: row.value
  }
}

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const db = getDb(event)

  const { results } = await db
    .prepare(
      `
        SELECT key, value
        FROM system_settings
        ORDER BY key ASC
      `
    )
    .all<SystemSettingRow>()

  const items = (results ?? []).map(mapSystemSettingRowToJson)

  return {
    items
  }
})

