import type { H3Event } from 'h3'
import { createError } from 'h3'
import { requireStation } from '~/server/utils/auth'

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
  preparing_employee_name: string | null
}

type LineItemRow = {
  id: number
  order_id: number
  product_id: number
  quantity: number
  unit_price: number
  customizations_json: string | null
  product_name: string
}

function normalizeStatus (status: string) {
  return status === 'delivered' ? 'completed' : status
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
    status: normalizeStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    displayOrderNumber: row.display_order_number,
    deliveredAt: row.delivered_at,
    preparingEmployeeId: row.preparing_employee_id,
    preparingEmployeeName: row.preparing_employee_name
  }
}

function mapLineItemRowToJson (row: LineItemRow) {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    customizations: parseCustomizations(row.customizations_json)
  }
}

export default defineEventHandler(async (event) => {
  requireStation(event)

  const db = getDb(event)

  const [ordersResult, lineItemsResult] = await Promise.all([
    db
      .prepare(
        `
          SELECT
            o.id,
            o.status,
            o.created_at,
            o.updated_at,
            o.customer_name,
            o.customer_email,
            o.display_order_number,
            o.delivered_at,
            o.preparing_employee_id,
            e.name AS preparing_employee_name
          FROM orders o
          LEFT JOIN employees e
            ON e.id = o.preparing_employee_id
          WHERE o.status IN ('new', 'preparing', 'ready', 'completed', 'delivered')
          ORDER BY o.created_at ASC, o.id ASC
        `
      )
      .all<OrderRow>(),
    db
      .prepare(
        `
          SELECT
            oli.id,
            oli.order_id,
            oli.product_id,
            oli.quantity,
            oli.unit_price,
            oli.customizations_json,
            p.name AS product_name
          FROM order_line_items oli
          INNER JOIN products p
            ON p.id = oli.product_id
          ORDER BY oli.order_id ASC, oli.id ASC
        `
      )
      .all<LineItemRow>()
  ])

  const lineItems = (lineItemsResult.results ?? []).map(mapLineItemRowToJson)
  const lineItemsByOrderId = new Map<number, ReturnType<typeof mapLineItemRowToJson>[]>()

  lineItems.forEach((item) => {
    const existing = lineItemsByOrderId.get(item.orderId) ?? []
    existing.push(item)
    lineItemsByOrderId.set(item.orderId, existing)
  })

  const items = (ordersResult.results ?? []).map((row) => {
    const mapped = mapOrderRowToJson(row)
    return {
      ...mapped,
      lineItems: lineItemsByOrderId.get(mapped.id) ?? []
    }
  })

  return {
    items
  }
})

