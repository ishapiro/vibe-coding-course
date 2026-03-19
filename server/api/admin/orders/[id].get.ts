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

type OrderRow = {
  id: number
  status: string
  created_at: string
  updated_at: string
  customer_name: string
  customer_email: string | null
  display_order_number: string
  delivered_at: string | null
  preparing_employee_id: number | null
}

type LineItemRow = {
  id: number
  product_id: number
  quantity: number
  unit_price: number
  customizations_json: string | null
  product_name: string
}

function parseCustomizations (value: string | null) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function mapOrderRowToJson (row: OrderRow) {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    displayOrderNumber: row.display_order_number,
    deliveredAt: row.delivered_at,
    preparingEmployeeId: row.preparing_employee_id
  }
}

function mapLineItemRowToJson (row: LineItemRow) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    customizations: parseCustomizations(row.customizations_json)
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
      error: 'Invalid order id'
    }
  }

  const db = getDb(event)

  const { results } = await db
    .prepare(
      `
        SELECT
          id,
          status,
          created_at,
          updated_at,
          customer_name,
          customer_email,
          display_order_number,
          delivered_at,
          preparing_employee_id
        FROM orders
        WHERE id = ?
      `
    )
    .bind(id)
    .all<OrderRow>()

  const row = results?.[0]

  if (!row) {
    setResponseStatus(event, 404)
    return {
      ok: false,
      error: 'Order not found'
    }
  }

  const { results: lineItemResults } = await db
    .prepare(
      `
        SELECT
          oli.id,
          oli.product_id,
          oli.quantity,
          oli.unit_price,
          oli.customizations_json,
          p.name AS product_name
        FROM order_line_items oli
        INNER JOIN products p ON p.id = oli.product_id
        WHERE oli.order_id = ?
        ORDER BY oli.id ASC
      `
    )
    .bind(id)
    .all<LineItemRow>()

  return {
    ok: true,
    item: mapOrderRowToJson(row),
    lineItems: (lineItemResults ?? []).map(mapLineItemRowToJson)
  }
})

