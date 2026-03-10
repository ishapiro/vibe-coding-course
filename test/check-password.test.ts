import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8787'

describe('/api/check-password', () => {
  it('returns 400 when role or password is missing', async () => {
    const res = await fetch(`${BASE_URL}/api/check-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.ok).toBe(false)
  })

  it('returns ok=false for incorrect admin password', async () => {
    const res = await fetch(`${BASE_URL}/api/check-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'admin',
        password: 'definitely-wrong'
      })
    })

    // May be 200 or 401 depending on implementation, but ok should be false
    const data = await res.json()
    expect(data.ok).toBe(false)
  })

  it('accepts the correct admin password from env', async () => {
    const adminPassword = process.env.NUXT_ADMIN_PASSWORD

    if (!adminPassword) {
      throw new Error(
        'NUXT_ADMIN_PASSWORD must be set in the test environment to run this test.'
      )
    }

    const res = await fetch(`${BASE_URL}/api/check-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'admin',
        password: adminPassword
      })
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })
})

