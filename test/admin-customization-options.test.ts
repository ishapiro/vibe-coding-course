import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8787'

function getAdminPassword () {
  const adminPassword = process.env.NUXT_ADMIN_PASSWORD

  if (!adminPassword) {
    throw new Error(
      'NUXT_ADMIN_PASSWORD must be set in the test environment to run /api/admin/customization-options tests.'
    )
  }

  return adminPassword
}

async function createTestCategory (adminPassword: string) {
  const res = await fetch(`${BASE_URL}/api/admin/categories`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-admin-password': adminPassword
    },
    body: JSON.stringify({
      name: 'Customization Test Category',
      ordering: Date.now(),
      kind: 'customization-test'
    })
  })

  expect(res.status).toBe(201)
  const json = await res.json()

  expect(json.ok).toBe(true)
  expect(json.item).toBeDefined()

  return json.item as { id: number }
}

describe('/api/admin/customization-options', () => {
  it('rejects requests without admin credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/customization-options`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })

    expect(res.status).toBe(401)
  })

  it('can create, list, update, and delete a customization option (idempotent)', async () => {
    const adminPassword = getAdminPassword()

    const category = await createTestCategory(adminPassword)

    // 1. List before
    const listBeforeRes = await fetch(
      `${BASE_URL}/api/admin/customization-options`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-admin-password': adminPassword
        }
      }
    )

    expect(listBeforeRes.status).toBe(200)
    const listBeforeJson = await listBeforeRes.json()

    const itemsBefore = Array.isArray(listBeforeJson.items)
      ? listBeforeJson.items
      : []

    const maxOrdering =
      itemsBefore.reduce(
        (max: number, item: any) =>
          typeof item.ordering === 'number' && !Number.isNaN(item.ordering)
            ? Math.max(max, item.ordering)
            : max,
        0
      ) || 0

    const newOrdering = maxOrdering + 1

    // 2. Create
    const createRes = await fetch(
      `${BASE_URL}/api/admin/customization-options`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({
          categoryId: category.id,
          label: 'Extra Sauce',
          kind: 'boolean',
          options: null,
          ordering: newOrdering
        })
      }
    )

    expect(createRes.status).toBe(201)
    const createJson = await createRes.json()

    expect(createJson.ok).toBe(true)
    expect(createJson.item).toBeDefined()

    const created = createJson.item as any

    expect(created.categoryId).toBe(category.id)
    expect(created.productId).toBeNull()
    expect(created.label).toBe('Extra Sauce')
    expect(created.kind).toBe('boolean')
    expect(created.ordering).toBe(newOrdering)
    expect(typeof created.id).toBe('number')

    const createdId = created.id

    // 3. Verify appears in list
    const listAfterRes = await fetch(
      `${BASE_URL}/api/admin/customization-options`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-admin-password': adminPassword
        }
      }
    )

    expect(listAfterRes.status).toBe(200)
    const listAfterJson = await listAfterRes.json()

    const itemsAfter = Array.isArray(listAfterJson.items)
      ? listAfterJson.items
      : []

    const found = itemsAfter.find((item: any) => item.id === createdId)
    expect(found).toBeDefined()
    expect(found.label).toBe('Extra Sauce')

    // 4. Update
    const updateRes = await fetch(
      `${BASE_URL}/api/admin/customization-options/${createdId}`,
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({
          categoryId: category.id,
          label: 'Extra Sauce (updated)',
          kind: 'boolean',
          options: JSON.stringify(['yes', 'no']),
          ordering: newOrdering
        })
      }
    )

    expect(updateRes.status).toBe(200)
    const updateJson = await updateRes.json()

    expect(updateJson.ok).toBe(true)
    expect(updateJson.item).toBeDefined()

    const updated = updateJson.item as any

    expect(updated.id).toBe(createdId)
    expect(updated.label).toBe('Extra Sauce (updated)')
    expect(updated.kind).toBe('boolean')
    expect(updated.ordering).toBe(newOrdering)

    // 5. Delete
    const deleteRes = await fetch(
      `${BASE_URL}/api/admin/customization-options/${createdId}`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'x-admin-password': adminPassword
        }
      }
    )

    expect(deleteRes.status).toBe(200)
    const deleteJson = await deleteRes.json()

    expect(deleteJson.ok).toBe(true)

    // 6. Verify gone from list
    const listFinalRes = await fetch(
      `${BASE_URL}/api/admin/customization-options`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-admin-password': adminPassword
        }
      }
    )

    expect(listFinalRes.status).toBe(200)
    const listFinalJson = await listFinalRes.json()

    const itemsFinal = Array.isArray(listFinalJson.items)
      ? listFinalJson.items
      : []

    const stillThere = itemsFinal.find((item: any) => item.id === createdId)
    expect(stillThere).toBeUndefined()
  })
})

