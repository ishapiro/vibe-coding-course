import type { H3Event } from 'h3'
import { createError } from 'h3'

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

type ExistingActiveOrderRow = {
  id: number
}

type ProductRow = {
  id: number
  price: number
}

type LastOrderNumberRow = {
  value: string
}

function isValidEmail (email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function formatDisplayOrderNumber (value: number) {
  return `ORD-${String(value).padStart(4, '0')}`
}

/**
 * Atomically increments `last_order_number` using optimistic locking.
 * This avoids race conditions without requiring multi-statement transactions.
 */
async function incrementAndGetLastOrderNumber (db: D1Database) {
  await db
    .prepare(
      `
        INSERT OR IGNORE INTO system_settings (key, value)
        VALUES ('last_order_number', '0')
      `
    )
    .run()

  for (let attempt = 0; attempt < 10; attempt++) {
    const currentResult = await db
      .prepare(
        `
          SELECT value
          FROM system_settings
          WHERE key = 'last_order_number'
        `
      )
      .all<LastOrderNumberRow>()

    const currentValue = currentResult.results?.[0]?.value ?? '0'
    const current = Number(currentValue)

    if (Number.isNaN(current)) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Server Error',
        message: 'Invalid last_order_number setting'
      })
    }

    const next = current + 1

    const updateResult = await db
      .prepare(
        `
          UPDATE system_settings
          SET value = ?
          WHERE key = 'last_order_number'
            AND value = ?
        `
      )
      .bind(String(next), String(current))
      .run()

    const changes = updateResult.meta?.changes as number | undefined
    if (changes && changes > 0) {
      return next
    }
  }

  throw createError({
    statusCode: 409,
    statusMessage: 'Conflict',
    message: 'Could not allocate a unique order number. Please retry.'
  })
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    customerName?: string
    customerEmail?: string
    items?: Array<{
      productId?: number | string
      quantity?: number | string
      customizations?: unknown
    }>
  }>(event)

  const customerName = body?.customerName?.trim() || ''
  const customerEmail = body?.customerEmail?.trim() || ''
  const items = Array.isArray(body?.items) ? body.items : []

  if (!customerName || !customerEmail) {
    setResponseStatus(event, 400)
    return {
      ok: false,
      error: 'Customer name and email are required.'
    }
  }

  if (!isValidEmail(customerEmail)) {
    setResponseStatus(event, 400)
    return {
      ok: false,
      error: 'Please provide a valid email address.'
    }
  }

  if (items.length === 0) {
    setResponseStatus(event, 400)
    return {
      ok: false,
      error: 'Cart must contain at least one item.'
    }
  }

  const db = getDb(event)

  // Enforce one active order per customer name (email can repeat across different names).
  const existingActiveResult = await db
    .prepare(
      `
        SELECT id
        FROM orders
        WHERE lower(trim(customer_name)) = lower(trim(?))
          AND status NOT IN ('delivered', 'cancelled')
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `
    )
    .bind(customerName)
    .all<ExistingActiveOrderRow>()

  if (existingActiveResult.results?.[0]) {
    setResponseStatus(event, 409)
    return {
      ok: false,
      error: `An active order already exists for "${customerName}". Please wait for completion or use a different customer name.`
    }
  }

  const nextOrderNumber = await incrementAndGetLastOrderNumber(db)
  const displayOrderNumber = formatDisplayOrderNumber(nextOrderNumber)
  const now = new Date().toISOString()

  const insertOrderResult = await db
    .prepare(
      `
        INSERT INTO orders (
          status,
          customer_name,
          customer_email,
          display_order_number,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .bind('new', customerName, customerEmail, displayOrderNumber, now)
    .run()

  const orderId = insertOrderResult.meta?.last_row_id as number | undefined
  if (!orderId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server Error',
      message: 'Failed to create order'
    })
  }

  let itemCount = 0
  let total = 0

  for (const rawItem of items) {
    const productId = Number(rawItem?.productId)
    const quantityValue =
      rawItem?.quantity !== undefined && rawItem?.quantity !== null
        ? Number(rawItem.quantity)
        : 1

    if (Number.isNaN(productId) || Number.isNaN(quantityValue) || quantityValue <= 0) {
      setResponseStatus(event, 400)
      return {
        ok: false,
        error: 'Invalid cart item payload.'
      }
    }

    const quantity = Math.floor(quantityValue)
    const productResult = await db
      .prepare(
        `
          SELECT id, price
          FROM products
          WHERE id = ?
        `
      )
      .bind(productId)
      .all<ProductRow>()

    const product = productResult.results?.[0]
    if (!product) {
      setResponseStatus(event, 400)
      return {
        ok: false,
        error: `Invalid product in cart: ${productId}`
      }
    }

    const unitPrice = product.price
    itemCount += quantity
    total += unitPrice * quantity

    const customizationsJson =
      rawItem?.customizations !== undefined && rawItem?.customizations !== null
        ? JSON.stringify(rawItem.customizations)
        : null

    await db
      .prepare(
        `
          INSERT INTO order_line_items (
            order_id,
            product_id,
            quantity,
            unit_price,
            customizations_json
          )
          VALUES (?, ?, ?, ?, ?)
        `
      )
      .bind(orderId, productId, quantity, unitPrice, customizationsJson)
      .run()
  }

  setResponseStatus(event, 201)
  return {
    ok: true,
    item: {
      id: orderId,
      status: 'new',
      customerName,
      customerEmail,
      displayOrderNumber,
      itemCount,
      total
    }
  }
})

