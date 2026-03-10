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

type ProductRow = {
  id: number
  product_class_id: number
  name: string
  description: string | null
  price: number
  ordering: number
}

function mapProductRowToJson (row: ProductRow) {
  return {
    id: row.id,
    categoryId: row.product_class_id,
    name: row.name,
    description: row.description,
    price: row.price,
    ordering: row.ordering
  }
}

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const db = getDb(event)

  const { results } = await db
    .prepare(
      `
        SELECT id, product_class_id, name, description, price, ordering
        FROM products
        ORDER BY ordering ASC, id ASC
      `
    )
    .all<ProductRow>()

  const items = (results ?? []).map(mapProductRowToJson)

  return {
    items
  }
})

