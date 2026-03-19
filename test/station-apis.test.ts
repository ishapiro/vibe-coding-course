import { describe, expect, it } from 'vitest'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8787'

function getStationPassword () {
  const stationPassword = process.env.NUXT_STATION_PASSWORD

  if (!stationPassword) {
    throw new Error(
      'NUXT_STATION_PASSWORD must be set in the test environment to run station API tests.'
    )
  }

  return stationPassword
}

describe('station employees API', () => {
  it('rejects list requests without station credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/station/employees`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })

    expect(res.status).toBe(401)
  })

  it('returns employees list with station credentials', async () => {
    const stationPassword = getStationPassword()

    const res = await fetch(`${BASE_URL}/api/station/employees`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-station-password': stationPassword
      }
    })

    expect(res.status).toBe(200)
    const json = await res.json()

    expect(Array.isArray(json.items)).toBe(true)
    if (json.items.length > 0) {
      expect(typeof json.items[0].id).toBe('number')
      expect(typeof json.items[0].name).toBe('string')
      expect(typeof json.items[0].active).toBe('boolean')
    }
  })
})

describe('station orders APIs', () => {
  it('rejects list requests without station credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/station/orders`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })

    expect(res.status).toBe(401)
  })

  it('returns active orders with line items using station credentials', async () => {
    const stationPassword = getStationPassword()

    const res = await fetch(`${BASE_URL}/api/station/orders`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-station-password': stationPassword
      }
    })

    expect(res.status).toBe(200)
    const json = await res.json()

    expect(Array.isArray(json.items)).toBe(true)
    if (json.items.length > 0) {
      const first = json.items[0]
      expect(typeof first.id).toBe('number')
      expect(typeof first.status).toBe('string')
      expect(Array.isArray(first.lineItems)).toBe(true)
    }
  })

  it('validates update payload and handles non-existent order ids', async () => {
    const stationPassword = getStationPassword()
    const missingId = 999999

    const badStatusRes = await fetch(`${BASE_URL}/api/station/orders/${missingId}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-station-password': stationPassword
      },
      body: JSON.stringify({
        status: 'invalid-status'
      })
    })

    expect(badStatusRes.status).toBe(400)

    const missingOrderRes = await fetch(`${BASE_URL}/api/station/orders/${missingId}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-station-password': stationPassword
      },
      body: JSON.stringify({
        status: 'ready',
        preparingEmployeeId: null
      })
    })

    expect(missingOrderRes.status === 404 || missingOrderRes.status === 200).toBe(true)
    const missingOrderJson = await missingOrderRes.json()
    expect(typeof missingOrderJson.ok === 'boolean' || !!missingOrderJson.error).toBe(true)
  })
})

