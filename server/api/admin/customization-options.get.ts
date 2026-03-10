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

type CustomizationOptionRow = {
  id: number
  product_class_id: number | null
  product_id: number | null
  label: string
  kind: string
  options: string | null
  ordering: number
}

function mapCustomizationOptionRowToJson (row: CustomizationOptionRow) {
  return {
    id: row.id,
    categoryId: row.product_class_id,
    productId: row.product_id,
    label: row.label,
    kind: row.kind,
    options: row.options,
    ordering: row.ordering
  }
}

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const db = getDb(event)

  const { results } = await db
    .prepare(
      `
        SELECT
          id,
          product_class_id,
          product_id,
          label,
          kind,
          options,
          ordering
        FROM customization_options
        ORDER BY
          product_class_id IS NULL,
          product_class_id,
          product_id IS NULL,
          product_id,
          ordering ASC,
          id ASC
      `
    )
    .all<CustomizationOptionRow>()

  const items = (results ?? []).map(mapCustomizationOptionRowToJson)

  return {
    items
  }
})

