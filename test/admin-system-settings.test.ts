import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8787'

function getAdminPassword () {
  const adminPassword = process.env.NUXT_ADMIN_PASSWORD

  if (!adminPassword) {
    throw new Error(
      'NUXT_ADMIN_PASSWORD must be set in the test environment to run /api/admin/system-settings tests.'
    )
  }

  return adminPassword
}

describe('/api/admin/system-settings', () => {
  it('rejects requests without admin credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/system-settings`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })

    expect(res.status).toBe(401)
  })

  it('can set and list system settings (idempotent)', async () => {
    const adminPassword = getAdminPassword()
    const key = 'test_setting_admin_api'
    const value = `value-${Date.now()}`

    // 1. Set the value
    const setRes = await fetch(`${BASE_URL}/api/admin/system-settings`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-admin-password': adminPassword
      },
      body: JSON.stringify({
        key,
        value
      })
    })

    expect(setRes.status).toBe(201)
    const setJson = await setRes.json()

    expect(setJson.ok).toBe(true)
    expect(setJson.item).toBeDefined()

    const saved = setJson.item as any
    expect(saved.key).toBe(key)
    expect(saved.value).toBe(value)

    // 2. List and ensure our key is present
    const listRes = await fetch(`${BASE_URL}/api/admin/system-settings`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-admin-password': adminPassword
      }
    })

    expect(listRes.status).toBe(200)
    const listJson = await listRes.json()

    const items = Array.isArray(listJson.items) ? listJson.items : []
    const found = items.find((item: any) => item.key === key)

    expect(found).toBeDefined()
    expect(found.value).toBe(value)
  })
})

