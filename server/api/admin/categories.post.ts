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

  const body = await readBody<{
    name?: string
    ordering?: number | string | null
    kind?: string | null
  }>(event)

  const name = body?.name?.trim()
  const orderingValue =
    body?.ordering !== undefined && body?.ordering !== null
      ? Number(body.ordering)
      : null
  const kind = body?.kind ?? null

  if (!name) {
    setResponseStatus(event, 400)
    return {
      ok: false,
      error: 'Missing category name'
    }
  }

  if (orderingValue !== null && Number.isNaN(orderingValue)) {
    setResponseStatus(event, 400)
    return {
      ok: false,
      error: 'Invalid ordering'
    }
  }

  const db = getDb(event)

  let row: CategoryRow | undefined

  try {
    const insertResult = await db
      .prepare(
        `
          INSERT INTO product_classes (name, ordering, kind)
          VALUES (?, ?, ?)
        `
      )
      .bind(name, orderingValue, kind)
      .run()

    const lastRowId = insertResult.meta?.last_row_id as number | undefined

    if (!lastRowId) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Server Error',
        message: 'Failed to create category'
      })
    }

    const result = await db
      .prepare(
        `
          SELECT id, name, ordering, kind
          FROM product_classes
          WHERE id = ?
        `
      )
      .bind(lastRowId)
      .all<CategoryRow>()

    row = result.results?.[0]
  } catch (error: any) {
    const message =
      (error?.cause?.message as string | undefined) ??
      (error?.message as string | undefined) ??
      ''

    if (
      typeof message === 'string' &&
      message.includes('UNIQUE constraint failed: product_classes.ordering')
    ) {
      setResponseStatus(event, 400)
      return {
        ok: false,
        error: 'Ordering must be unique'
      }
    }

    throw error
  }

  if (!row) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server Error',
      message: 'Failed to load created category'
    })
  }

  setResponseStatus(event, 201)

  return {
    ok: true,
    item: mapCategoryRowToJson(row)
  }
})

