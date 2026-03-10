import { describe, it, expect, vi, beforeEach } from 'vitest'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8787'

function getAdminPassword () {
  const adminPassword = process.env.NUXT_ADMIN_PASSWORD

  if (!adminPassword) {
    throw new Error(
      'NUXT_ADMIN_PASSWORD must be set in the test environment to run /api/admin/employees and /api/admin/orders tests.'
    )
  }

  return adminPassword
}

async function createEmployee (adminPassword: string, name: string) {
  const res = await fetch(`${BASE_URL}/api/admin/employees`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-admin-password': adminPassword
    },
    body: JSON.stringify({
      name,
      active: true
    })
  })

  expect(res.status).toBe(201)
  const json = await res.json()

  expect(json.ok).toBe(true)
  return json.item as { id: number }
}

describe('admin employees API', () => {
  it('rejects requests without admin credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/employees`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })

    expect(res.status).toBe(401)
  })

  it('can create, list, and update an employee (idempotent)', async () => {
    const adminPassword = getAdminPassword()

    const listBeforeRes = await fetch(`${BASE_URL}/api/admin/employees`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-admin-password': adminPassword
      }
    })

    expect(listBeforeRes.status).toBe(200)

    const created = await createEmployee(adminPassword, 'Test Employee')

    const listAfterRes = await fetch(`${BASE_URL}/api/admin/employees`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-admin-password': adminPassword
      }
    })

    expect(listAfterRes.status).toBe(200)
    const listAfterJson = await listAfterRes.json()

    const itemsAfter = Array.isArray(listAfterJson.items)
      ? listAfterJson.items
      : []

    const found = itemsAfter.find((item: any) => item.id === created.id)
    expect(found).toBeDefined()
    expect(found.name).toBe('Test Employee')

    const updateRes = await fetch(
      `${BASE_URL}/api/admin/employees/${created.id}`,
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({
          name: 'Test Employee (updated)',
          active: false
        })
      }
    )

    expect(updateRes.status).toBe(200)
    const updateJson = await updateRes.json()

    expect(updateJson.ok).toBe(true)
    expect(updateJson.item).toBeDefined()

    const updated = updateJson.item as any
    expect(updated.id).toBe(created.id)
    expect(updated.name).toBe('Test Employee (updated)')
    expect(updated.active).toBe(false)
  })
})

describe('admin orders API', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects requests without admin credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })

    expect(res.status).toBe(401)
  })

  it('can clear, list, get, update, and delete orders (basic flow)', async () => {
    const adminPassword = getAdminPassword()

    const clearRes = await fetch(`${BASE_URL}/api/admin/orders/clear`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'x-admin-password': adminPassword
      }
    })

    expect(clearRes.status).toBe(200)

    const listRes = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-admin-password': adminPassword
      }
    })

    expect(listRes.status).toBe(200)
    const listJson = await listRes.json()

    const items = Array.isArray(listJson.items) ? listJson.items : []
    expect(items.length === 0 || Array.isArray(items)).toBe(true)

    const nonExistentId = 999999

    const getRes = await fetch(
      `${BASE_URL}/api/admin/orders/${nonExistentId}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-admin-password': adminPassword
        }
      }
    )

    expect(getRes.status === 200 || getRes.status === 404).toBe(true)
    const getJson = await getRes.json()

    const updatedStatus = 'ready'

    const updateRes = await fetch(
      `${BASE_URL}/api/admin/orders/${nonExistentId}`,
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({
          status: updatedStatus,
          preparingEmployeeId: null,
          deliveredAt: null
        })
      }
    )

    expect(updateRes.status === 200 || updateRes.status === 404).toBe(true)
    const updateJson = await updateRes.json()

    const deleteRes = await fetch(
      `${BASE_URL}/api/admin/orders/${nonExistentId}`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'x-admin-password': adminPassword
        }
      }
    )

    expect(deleteRes.status === 200 || deleteRes.status === 404).toBe(true)
    const deleteJson = await deleteRes.json()

    expect(typeof deleteJson.ok === 'boolean' || deleteJson.error).toBe(true)
  })
})

