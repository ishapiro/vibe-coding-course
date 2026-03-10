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

type EmployeeRow = {
  id: number
  name: string
  active: number
}

function mapEmployeeRowToJson (row: EmployeeRow) {
  return {
    id: row.id,
    name: row.name,
    active: !!row.active
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
      error: 'Invalid employee id'
    }
  }

  const body = await readBody<{
    name?: string
    active?: boolean
  }>(event)

  const name = body?.name?.trim()
  const active = body?.active !== false

  if (!name) {
    setResponseStatus(event, 400)
    return {
      ok: false,
      error: 'Missing employee name'
    }
  }

  const db = getDb(event)

  const updateResult = await db
    .prepare(
      `
        UPDATE employees
        SET name = ?, active = ?
        WHERE id = ?
      `
    )
    .bind(name, active ? 1 : 0, id)
    .run()

  const changes = updateResult.meta?.changes as number | undefined

  if (!changes) {
    setResponseStatus(event, 404)
    return {
      ok: false,
      error: 'Employee not found'
    }
  }

  const { results } = await db
    .prepare(
      `
        SELECT id, name, active
        FROM employees
        WHERE id = ?
      `
    )
    .bind(id)
    .all<EmployeeRow>()

  const row = results?.[0]

  if (!row) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server Error',
      message: 'Failed to load updated employee'
    })
  }

  return {
    ok: true,
    item: mapEmployeeRowToJson(row)
  }
})

