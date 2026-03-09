import type { H3Event } from 'h3'
import { getHeader, createError } from 'h3'
import { useRuntimeConfig } from '#imports'

type Role = 'admin' | 'station'

function checkRolePassword (event: H3Event, role: Role, headerName: string) {
  const provided = getHeader(event, headerName) ?? ''

  if (!provided) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Missing credentials'
    })
  }

  const config = useRuntimeConfig(event)

  const expected =
    role === 'admin' ? config.adminPassword : config.stationPassword

  if (!expected) {
    // Configuration error: the expected password is not set for this role.
    throw createError({
      statusCode: 500,
      statusMessage: 'Server Error',
      message: 'Password not configured for this role'
    })
  }

  if (provided !== expected) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid credentials'
    })
  }
}

/**
 * Require a valid admin password for this request.
 * Expects the password in the `x-admin-password` header.
 * Throws a 401 error if unauthorized.
 */
export function requireAdmin (event: H3Event) {
  checkRolePassword(event, 'admin', 'x-admin-password')
}

/**
 * Require a valid station password for this request.
 * Expects the password in the `x-station-password` header.
 * Throws a 401 error if unauthorized.
 */
export function requireStation (event: H3Event) {
  checkRolePassword(event, 'station', 'x-station-password')
}

