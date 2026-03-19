import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8787'

describe('public menu/settings APIs', () => {
  it('returns menu categories and products without auth', async () => {
    const res = await fetch(`${BASE_URL}/api/menu`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })

    expect(res.status).toBe(200)
    const json = await res.json()

    expect(Array.isArray(json.categories)).toBe(true)
    expect(Array.isArray(json.products)).toBe(true)

    if (json.categories.length > 0) {
      const category = json.categories[0]
      expect(typeof category.id).toBe('number')
      expect(typeof category.name).toBe('string')
      expect(typeof category.ordering).toBe('number')
    }

    if (json.products.length > 0) {
      const product = json.products[0]
      expect(typeof product.id).toBe('number')
      expect(typeof product.categoryId).toBe('number')
      expect(typeof product.name).toBe('string')
      expect(typeof product.price).toBe('number')
    }
  })

  it('returns public app settings without auth', async () => {
    const res = await fetch(`${BASE_URL}/api/public-settings`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })

    expect(res.status).toBe(200)
    const json = await res.json()

    expect(Array.isArray(json.items)).toBe(true)
    expect(typeof json.byKey).toBe('object')
    expect(json.byKey).not.toBeNull()

    if (json.items.length > 0) {
      const setting = json.items[0]
      expect(typeof setting.key).toBe('string')
      expect(typeof setting.value).toBe('string')
    }
  })
})

