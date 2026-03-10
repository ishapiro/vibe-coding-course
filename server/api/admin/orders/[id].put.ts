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

async function sendReadyForPickupEmail (
  event: H3Event,
  order: OrderRow
): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!resendApiKey || !from || !order.customer_email) {
    return
  }

  const to = order.customer_email

  const subject = `Your order ${order.display_order_number} is ready for pickup`
  const text = `Hi ${order.customer_name || 'there'}, your order ${
    order.display_order_number
  } is ready for pickup.`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text
      })
    })
  } catch {
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

  const body = await readBody<{
    status?: string
    preparingEmployeeId?: number | string | null
    deliveredAt?: string | null
  }>(event)

  const status = body?.status?.trim()

  const hasPreparingEmployeeId =
    body?.preparingEmployeeId !== undefined &&
    body?.preparingEmployeeId !== null
  const preparingEmployeeId = hasPreparingEmployeeId
    ? Number(body?.preparingEmployeeId)
    : null

  const deliveredAt = body?.deliveredAt ?? null

  if (!status) {
    setResponseStatus(event, 400)
    return {
      ok: false,
      error: 'Missing order status'
    }
  }

  if (hasPreparingEmployeeId && Number.isNaN(preparingEmployeeId)) {
    setResponseStatus(event, 400)
    return {
      ok: false,
      error: 'Invalid preparingEmployeeId'
    }
  }

  const db = getDb(event)

  const { results: existingResults } = await db
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

  const existing = existingResults?.[0]

  if (!existing) {
    setResponseStatus(event, 404)
    return {
      ok: false,
      error: 'Order not found'
    }
  }

  const now = new Date().toISOString()

  const updateResult = await db
    .prepare(
      `
        UPDATE orders
        SET
          status = ?,
          preparing_employee_id = ?,
          delivered_at = ?,
          updated_at = ?
        WHERE id = ?
      `
    )
    .bind(status, preparingEmployeeId, deliveredAt, now, id)
    .run()

  const changes = updateResult.meta?.changes as number | undefined

  if (!changes) {
    setResponseStatus(event, 404)
    return {
      ok: false,
      error: 'Order not found'
    }
  }

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
    throw createError({
      statusCode: 500,
      statusMessage: 'Server Error',
      message: 'Failed to load updated order'
    })
  }

  if (status === 'ready') {
    await sendReadyForPickupEmail(event, row)
  }

  return {
    ok: true,
    item: mapOrderRowToJson(row)
  }
})

