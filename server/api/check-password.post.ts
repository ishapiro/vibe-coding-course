export default defineEventHandler(async (event) => {
  const body = await readBody<{
    role?: 'admin' | 'station'
    password?: string
  }>(event)

  const role = body?.role
  const password = body?.password

  if (!role || !password) {
    setResponseStatus(event, 400)
    return {
      ok: false,
      error: 'Missing role or password'
    }
  }

  if (role !== 'admin' && role !== 'station') {
    setResponseStatus(event, 400)
    return {
      ok: false,
      error: 'Invalid role'
    }
  }

  const config = useRuntimeConfig(event)

  const expected =
    role === 'admin' ? config.adminPassword : config.stationPassword

  if (!expected) {
    setResponseStatus(event, 500)
    return {
      ok: false,
      error: 'Password not configured for this role'
    }
  }

  const ok = password === expected

  setResponseStatus(event, ok ? 200 : 401)

  return {
    ok
  }
})

