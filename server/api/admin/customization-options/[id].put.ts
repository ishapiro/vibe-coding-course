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

  const idParam = getRouterParam(event, 'id')
  const id = idParam ? Number(idParam) : NaN

  if (!idParam || Number.isNaN(id)) {
    setResponseStatus(event, 400)
    return {
      ok: false,
      error: 'Invalid customization option id'
    }
  }

  const body = await readBody<{
    categoryId?: number | string | null
    productId?: number | string | null
    label?: string
    kind?: string
    options?: unknown
    ordering?: number | string | null
  }>(event)

  const rawCategoryId = body?.categoryId
  const rawProductId = body?.productId

  const hasCategoryId = rawCategoryId !== undefined && rawCategoryId !== null
  const hasProductId = rawProductId !== undefined && rawProductId !== null

  const label = body?.label?.trim()
  const kind = body?.kind?.trim()

  let orderingValue: number | null = null

  if (body?.ordering !== undefined && body?.ordering !== null) {
    const parsedOrdering = Number(body.ordering)
    orderingValue = Number.isNaN(parsedOrdering) ? null : parsedOrdering
  }

  let options: string | null = null

  if (body?.options !== undefined && body?.options !== null) {
    options =
      typeof body.options === 'string'
        ? body.options
        : JSON.stringify(body.options)
  }

  if (!label || !kind || hasCategoryId === hasProductId) {
    setResponseStatus(event, 400)
    return {
      ok: false,
      error:
        'Missing required fields or invalid association (provide exactly one of categoryId or productId)'
    }
  }

  const categoryIdValue = hasCategoryId ? Number(rawCategoryId) : null
  const productIdValue = hasProductId ? Number(rawProductId) : null

  if (
    (hasCategoryId && (categoryIdValue === null || Number.isNaN(categoryIdValue))) ||
    (hasProductId && (productIdValue === null || Number.isNaN(productIdValue)))
  ) {
    setResponseStatus(event, 400)
    return {
      ok: false,
      error: 'Invalid categoryId or productId'
    }
  }

  const db = getDb(event)

  const updateResult = await db
    .prepare(
      `
        UPDATE customization_options
        SET
          product_class_id = ?,
          product_id = ?,
          label = ?,
          kind = ?,
          options = ?,
          ordering = ?
        WHERE id = ?
      `
    )
    .bind(
      categoryIdValue,
      productIdValue,
      label,
      kind,
      options,
      orderingValue ?? 0,
      id
    )
    .run()

  const changes = updateResult.meta?.changes as number | undefined

  if (!changes) {
    setResponseStatus(event, 404)
    return {
      ok: false,
      error: 'Customization option not found'
    }
  }

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
        WHERE id = ?
      `
    )
    .bind(id)
    .all<CustomizationOptionRow>()

  const row = results?.[0]

  if (!row) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server Error',
      message: 'Failed to load updated customization option'
    })
  }

  return {
    ok: true,
    item: mapCustomizationOptionRowToJson(row)
  }
})

