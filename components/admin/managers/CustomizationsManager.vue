<script setup lang="ts">
type Category = { id: number, name: string }
type Product = { id: number, name: string, categoryId: number }
type Customization = { id: number, categoryId: number | null, productId: number | null, label: string, kind: string, options: string | null, ordering: number }
type AssocType = 'category' | 'product'

const props = defineProps<{
  categories: Category[]
  products: Product[]
  items: Customization[]
  canManage: boolean
  errorMessage?: string | null
}>()

const emit = defineEmits<{ refresh: [] }>()
const api = useAdminApi()

const editingId = ref<number | null>(null)
const assocType = ref<AssocType>('category')
const categoryId = ref<number | null>(null)
const productId = ref<number | null>(null)
const label = ref('')
const kind = ref('')
const options = ref('')
const ordering = ref<number | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

const categoryMap = computed(() => new Map(props.categories.map(c => [c.id, c.name])))
const productMap = computed(() => new Map(props.products.map(p => [p.id, p.name])))

function nextOrdering () {
  return props.items.reduce((m, i) => Math.max(m, i.ordering || 0), 0) + 1
}

function resetForm () {
  editingId.value = null
  assocType.value = 'category'
  categoryId.value = props.categories[0]?.id ?? null
  productId.value = props.products[0]?.id ?? null
  label.value = ''
  kind.value = ''
  options.value = ''
  ordering.value = nextOrdering()
  error.value = null
}

function beginEdit (item: Customization) {
  editingId.value = item.id
  assocType.value = item.categoryId !== null ? 'category' : 'product'
  categoryId.value = item.categoryId
  productId.value = item.productId
  label.value = item.label
  kind.value = item.kind
  options.value = item.options ?? ''
  ordering.value = item.ordering
  error.value = null
}

async function submit () {
  if (!props.canManage) return
  error.value = null
  saving.value = true
  try {
    const body: Record<string, any> = {
      label: label.value.trim(),
      kind: kind.value.trim(),
      options: options.value.trim() || null,
      ordering: ordering.value
    }
    if (!body.label) throw new Error('Label is required.')
    if (!body.kind) throw new Error('Kind is required.')
    if (ordering.value === null || Number.isNaN(Number(ordering.value))) throw new Error('Ordering must be a number.')

    if (assocType.value === 'category') {
      if (!categoryId.value) throw new Error('Select a category.')
      body.categoryId = categoryId.value
    } else {
      if (!productId.value) throw new Error('Select a product.')
      body.productId = productId.value
    }

    if (editingId.value) await api.put(`/api/admin/customization-options/${editingId.value}`, body)
    else await api.post('/api/admin/customization-options', body)

    emit('refresh')
    resetForm()
  } catch (e: any) {
    error.value = String(e?.message || 'Failed to save customization.')
  } finally {
    saving.value = false
  }
}

async function removeItem (id: number) {
  if (!props.canManage) return
  if (!confirm('Delete this customization option?')) return
  saving.value = true
  error.value = null
  try {
    await api.del(`/api/admin/customization-options/${id}`)
    emit('refresh')
  } catch (e: any) {
    error.value = String(e?.message || 'Delete failed.')
  } finally {
    saving.value = false
  }
}

onMounted(resetForm)
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-lg font-semibold text-gray-900">Customizations</h2>
    <p class="text-sm text-gray-600">Link each customization to exactly one category OR one product.</p>
    <p v-if="errorMessage" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{{ errorMessage }}</p>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <h3 class="text-sm font-semibold text-gray-900">Existing Customizations</h3>
        <table class="mt-3 w-full text-sm">
          <thead class="text-left text-gray-500"><tr><th>Label</th><th>Linked To</th><th>Kind</th><th /></tr></thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="border-t border-gray-100">
              <td class="py-2">{{ item.label }}</td>
              <td>
                <span v-if="item.categoryId !== null">Category: {{ categoryMap.get(item.categoryId) || item.categoryId }}</span>
                <span v-else>Product: {{ productMap.get(item.productId || -1) || item.productId }}</span>
              </td>
              <td>{{ item.kind }}</td>
              <td class="text-right space-x-2">
                <button class="rounded-md border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50" :disabled="!canManage" @click="beginEdit(item)">Edit</button>
                <button class="rounded-md border border-red-200 px-3 py-1 text-sm text-red-700 hover:bg-red-50" :disabled="!canManage || saving" @click="removeItem(item.id)">Delete</button>
              </td>
            </tr>
            <tr v-if="items.length===0"><td colspan="4" class="py-3 text-gray-500">No customizations yet.</td></tr>
          </tbody>
        </table>
      </div>

      <form class="rounded-lg border border-gray-200 bg-white p-4 space-y-3" @submit.prevent="submit">
        <h3 class="text-sm font-semibold text-gray-900">{{ editingId ? 'Edit Customization' : 'Create Customization' }}</h3>
        <div class="flex gap-4 text-sm">
          <label><input v-model="assocType" type="radio" value="category" :disabled="saving || !canManage"> Category</label>
          <label><input v-model="assocType" type="radio" value="product" :disabled="saving || !canManage || products.length===0"> Product</label>
        </div>
        <div v-if="assocType==='category'">
          <label class="text-sm font-medium text-gray-700">Category</label>
          <select v-model.number="categoryId" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage">
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }} ({{ c.id }})</option>
          </select>
        </div>
        <div v-else>
          <label class="text-sm font-medium text-gray-700">Product</label>
          <select v-model.number="productId" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage || products.length===0">
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }} ({{ p.id }})</option>
          </select>
        </div>
        <div><label class="text-sm font-medium text-gray-700">Label</label><input v-model="label" type="text" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage"></div>
        <div><label class="text-sm font-medium text-gray-700">Kind</label><input v-model="kind" type="text" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage"></div>
        <div>
          <label class="text-sm font-medium text-gray-700">Options (optional, one item per line)</label>
          <textarea
            v-model="options"
            rows="4"
            placeholder="Small&#10;Medium&#10;Large"
            class="mt-1 w-full rounded-md border border-gray-300 bg-white text-gray-900 caret-brand placeholder:text-gray-400 focus:border-brand focus:ring-brand"
            :disabled="saving || !canManage"
          ></textarea>
        </div>
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

