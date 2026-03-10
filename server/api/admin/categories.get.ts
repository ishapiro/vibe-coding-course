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

type CategoryRow = {
  id: number
  name: string
  ordering: number
  kind: string | null
}

function mapCategoryRowToJson (row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    ordering: row.ordering,
    kind: row.kind
  }
}

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const db = getDb(event)

  const { results } = await db
    .prepare(
      `
        SELECT id, name, ordering, kind
        FROM product_classes
        ORDER BY ordering ASC, id ASC
      `
    )
    .all<CategoryRow>()

  const items = (results ?? []).map(mapCategoryRowToJson)

  return {
    items
  }
})

