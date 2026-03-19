<script setup lang="ts">
type Category = { id: number, name: string, ordering: number, kind: string | null }
type Product = { id: number, categoryId: number, name: string, description: string | null, price: number, ordering: number }

const props = defineProps<{
  categories: Category[]
  items: Product[]
  canManage: boolean
  errorMessage?: string | null
}>()

const emit = defineEmits<{ refresh: [] }>()
const api = useAdminApi()

const editingId = ref<number | null>(null)
const categoryId = ref<number | null>(null)
const name = ref('')
const description = ref('')
const price = ref<number | null>(null)
const ordering = ref<number | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

const categoriesById = computed(() => new Map(props.categories.map(c => [c.id, c.name])))

function formatDollars (value: number) {
  return `$${value.toFixed(2)}`
}

function nextOrdering () {
  return props.items.reduce((m, p) => Math.max(m, p.ordering || 0), 0) + 1
}

function resetForm () {
  editingId.value = null
  categoryId.value = props.categories[0]?.id ?? null
  name.value = ''
  description.value = ''
  price.value = null
  ordering.value = nextOrdering()
  error.value = null
}

function beginEdit (item: Product) {
  editingId.value = item.id
  categoryId.value = item.categoryId
  name.value = item.name
  description.value = item.description ?? ''
  price.value = item.price
  ordering.value = item.ordering
  error.value = null
}

async function submit () {
  if (!props.canManage) return
  error.value = null
  saving.value = true
  try {
    const body = {
      categoryId: categoryId.value,
      name: name.value.trim(),
      description: description.value.trim() || null,
      price: price.value,
      ordering: ordering.value
    }
    if (!body.categoryId) throw new Error('Select a category.')
    if (!body.name) throw new Error('Product name is required.')
    if (body.price === null || Number.isNaN(Number(body.price))) throw new Error('Price must be a number.')
    if (!/^\d+(\.\d{1,2})?$/.test(String(body.price))) throw new Error('Price must use dollars and cents (up to 2 decimals).')
    if (body.ordering === null || Number.isNaN(Number(body.ordering))) throw new Error('Ordering must be a number.')

    if (editingId.value) await api.put(`/api/admin/products/${editingId.value}`, body)
    else await api.post('/api/admin/products', body)
    emit('refresh')
    resetForm()
  } catch (e: any) {
    error.value = String(e?.message || 'Failed to save product.')
  } finally {
    saving.value = false
  }
}

onMounted(resetForm)
watch(() => props.categories.length, () => { if (!editingId.value) categoryId.value = props.categories[0]?.id ?? null })
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-lg font-semibold text-gray-900">
      Products
    </h2>
    <p class="text-sm text-gray-600">
      Products require an existing category.
    </p>

    <p v-if="errorMessage" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      {{ errorMessage }}
    </p>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <h3 class="text-sm font-semibold text-gray-900">Existing Products</h3>
        <table class="mt-3 w-full text-sm">
          <thead class="text-left text-gray-500">
            <tr><th>Name</th><th>Category</th><th>Price</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="border-t border-gray-100">
              <td class="py-2">{{ item.name }}</td>
              <td>{{ categoriesById.get(item.categoryId) || item.categoryId }}</td>
              <td>{{ formatDollars(item.price) }}</td>
              <td class="text-right"><button class="rounded-md border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50" :disabled="!canManage" @click="beginEdit(item)">Edit</button></td>
            </tr>
            <tr v-if="items.length === 0"><td colspan="4" class="py-3 text-gray-500">No products yet.</td></tr>
          </tbody>
        </table>
      </div>

      <form class="rounded-lg border border-gray-200 bg-white p-4 space-y-3" @submit.prevent="submit">
        <h3 class="text-sm font-semibold text-gray-900">{{ editingId ? 'Edit Product' : 'Create Product' }}</h3>
        <div>
          <label class="text-sm font-medium text-gray-700">Category</label>
          <select v-model.number="categoryId" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage || categories.length===0">
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }} ({{ c.id }})</option>
          </select>
        </div>
        <div><label class="text-sm font-medium text-gray-700">Name</label><input v-model="name" type="text" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage"></div>
        <div><label class="text-sm font-medium text-gray-700">Description (optional)</label><input v-model="description" type="text" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage"></div>
        <div><label class="text-sm font-medium text-gray-700">Price (USD)</label><input v-model.number="price" type="number" step="0.01" min="0" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage"></div>
        <div><label class="text-sm font-medium text-gray-700">Ordering</label><input v-model.number="ordering" type="number" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage"></div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <div class="flex gap-2">
          <button type="submit" class="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60" :disabled="saving || !canManage">{{ saving ? 'Saving…' : (editingId ? 'Update' : 'Create') }}</button>
          <button type="button" class="rounded-md border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50" :disabled="saving" @click="resetForm">Reset</button>
        </div>
      </form>
    </div>
  </section>
</template>

