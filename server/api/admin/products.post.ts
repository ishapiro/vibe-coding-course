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

  const body = await readBody<{
    categoryId?: number | string
    name?: string
    description?: string | null
    price?: number | string
    ordering?: number | string | null
  }>(event)

  const categoryIdValue =
    body?.categoryId !== undefined && body?.categoryId !== null
      ? Number(body.categoryId)
      : NaN
  const name = body?.name?.trim()
  const description = body?.description ?? null
  const priceValue =
    body?.price !== undefined && body?.price !== null
      ? Number(body.price)
      : NaN
  const orderingValue =
    body?.ordering !== undefined && body?.ordering !== null
      ? Number(body.ordering)
      : null

  if (!name || Number.isNaN(categoryIdValue) || Number.isNaN(priceValue)) {
    setResponseStatus(event, 400)
    return {
      ok: false,
      error: 'Missing or invalid product fields'
    }
  }

  const db = getDb(event)

  const insertResult = await db
    .prepare(
      `
        INSERT INTO products (product_class_id, name, description, price, ordering)
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .bind(categoryIdValue, name, description, priceValue, orderingValue)
    .run()

  const lastRowId = insertResult.meta?.last_row_id as number | undefined

  if (!lastRowId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server Error',
      message: 'Failed to create product'
    })
  }

  const { results } = await db
    .prepare(
      `
        SELECT id, product_class_id, name, description, price, ordering
        FROM products
        WHERE id = ?
      `
    )
    .bind(lastRowId)
    .all<ProductRow>()

  const row = results?.[0]

  if (!row) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server Error',
      message: 'Failed to load created product'
    })
  }

  setResponseStatus(event, 201)

  return {
    ok: true,
    item: mapProductRowToJson(row)
  }
})

