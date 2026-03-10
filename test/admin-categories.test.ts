import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8787'

function getAdminPassword () {
  const adminPassword = process.env.NUXT_ADMIN_PASSWORD

  if (!adminPassword) {
    throw new Error(
      'NUXT_ADMIN_PASSWORD must be set in the test environment to run /api/admin/categories tests.'
    )
  }

  return adminPassword
}

describe('/api/admin/categories', () => {
  it('rejects requests without admin credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/categories`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })

    expect(res.status).toBe(401)
  })

  it('can create, list, and update a category (idempotent)', async () => {
    const adminPassword = getAdminPassword()

    // 1. Fetch existing categories to choose the next unique ordering
    const listBeforeRes = await fetch(`${BASE_URL}/api/admin/categories`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-admin-password': adminPassword
      }
    })

    expect(listBeforeRes.status).toBe(200)
    const listBeforeJson = await listBeforeRes.json()

    expect(listBeforeJson).toBeTypeOf('object')
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
    const baseName = 'Test Category'
    const uniqueName = `${baseName} ${newOrdering}`

    // 2. Create a new category
    const createRes = await fetch(`${BASE_URL}/api/admin/categories`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-admin-password': adminPassword
      },
      body: JSON.stringify({
        name: uniqueName,
        ordering: newOrdering,
        kind: 'test-kind'
      })
    })

    expect(createRes.status).toBe(201)
    const createJson = await createRes.json()

    expect(createJson.ok).toBe(true)
    expect(createJson.item).toBeDefined()

    const created = createJson.item as any

    expect(created.name).toBe(uniqueName)
    expect(created.ordering).toBe(newOrdering)
    expect(created.kind).toBe('test-kind')
    expect(typeof created.id).toBe('number')

    const createdId = created.id

    // 3. Verify the new category appears in the list
    const listAfterRes = await fetch(`${BASE_URL}/api/admin/categories`, {
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

    const found = itemsAfter.find((item: any) => item.id === createdId)
    expect(found).toBeDefined()
    expect(found.name).toBe(uniqueName)

    // 4. Update the category name and kind, keeping the same ordering
    const updatedName = `${uniqueName} (updated)`
    const updateRes = await fetch(
      `${BASE_URL}/api/admin/categories/${createdId}`,
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({
          name: updatedName,
          ordering: newOrdering,
          kind: 'updated-kind'
        })
      }
    )

    expect(updateRes.status).toBe(200)
    const updateJson = await updateRes.json()

    expect(updateJson.ok).toBe(true)
    expect(updateJson.item).toBeDefined()

    const updated = updateJson.item as any

    expect(updated.id).toBe(createdId)
    expect(updated.name).toBe(updatedName)
    expect(updated.ordering).toBe(newOrdering)
    expect(updated.kind).toBe('updated-kind')
  })
})

