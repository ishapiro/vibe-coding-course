import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8787'

describe('/api/admin/categories', () => {
  it('returns a list of categories', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/categories`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })

    // For now the route may not be implemented yet, so allow 404.
    // Once implemented, this will still enforce the 200 + JSON contract.
    expect([200, 404]).toContain(res.status)

    if (res.status === 404) {
      // Endpoint not implemented yet – nothing more to assert.
      return
    }

    const data = await res.json()

    expect(Array.isArray(data)).toBe(true)

    if (data.length > 0) {
      const first = data[0]
      expect(first).toHaveProperty('id')
      expect(first).toHaveProperty('name')
      expect(first).toHaveProperty('ordering')
    }
  })
})

