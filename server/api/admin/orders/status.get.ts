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
  customer_name: string
  display_order_number: string
  created_at: string
  updated_at: string
}

type CountRow = {
  count: number
}

function mapOrderRowToJson (row: OrderRow) {
  return {
    id: row.id,
    status: row.status,
    customerName: row.customer_name,
    displayOrderNumber: row.display_order_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function getCountByStatus (db: D1Database, status: string) {
  const { results } = await db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM orders
        WHERE status = ?
      `
    )
    .bind(status)
    .all<CountRow>()

  return Number(results?.[0]?.count ?? 0)
}

async function getTotalCount (db: D1Database) {
  const { results } = await db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM orders
      `
    )
    .all<CountRow>()

  return Number(results?.[0]?.count ?? 0)
}

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const db = getDb(event)

  const [ordersResult, total, newCount, preparingCount, readyCount, completedCount] = await Promise.all([
    db
      .prepare(
        `
          SELECT
            id,
            status,
            customer_name,
            display_order_number,
            created_at,
            updated_at
          FROM orders
          WHERE status IN ('new', 'preparing', 'ready', 'completed')
          ORDER BY created_at ASC, id ASC
        `
      )
      .all<OrderRow>(),
    getTotalCount(db),
    getCountByStatus(db, 'new'),
    getCountByStatus(db, 'preparing'),
    getCountByStatus(db, 'ready'),
    getCountByStatus(db, 'completed')
  ])

  const orders = (ordersResult.results ?? []).map(mapOrderRowToJson)

  return {
    summary: {
      total,
      new: newCount,
      preparing: preparingCount,
      ready: readyCount,
      completed: completedCount
    },
    groups: {
      new: orders.filter(order => order.status === 'new'),
      preparing: orders.filter(order => order.status === 'preparing'),
      ready: orders.filter(order => order.status === 'ready'),
      completed: orders.filter(order => order.status === 'completed')
    }
  }
})

