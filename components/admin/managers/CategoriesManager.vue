<script setup lang="ts">
type Category = { id: number, name: string, ordering: number, kind: string | null }

const props = defineProps<{
  items: Category[]
  canManage: boolean
  errorMessage?: string | null
}>()

const emit = defineEmits<{
  refresh: []
}>()

const api = useAdminApi()

const editingId = ref<number | null>(null)
const name = ref('')
const kind = ref('')
const ordering = ref<number | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

function nextOrdering () {
  const max = props.items.reduce((m, c) => Math.max(m, c.ordering || 0), 0)
  return max + 1
}

function resetForm () {
  editingId.value = null
  name.value = ''
  kind.value = ''
  ordering.value = nextOrdering()
  error.value = null
}

function beginEdit (item: Category) {
  editingId.value = item.id
  name.value = item.name
  kind.value = item.kind ?? ''
  ordering.value = item.ordering
  error.value = null
}

async function submit () {
  if (!props.canManage) return
  error.value = null
  saving.value = true
  try {
    const body = {
      name: name.value.trim(),
      kind: kind.value.trim() || null,
      ordering: ordering.value
    }

    if (!body.name) throw new Error('Category name is required.')
    if (body.ordering === null || Number.isNaN(Number(body.ordering))) throw new Error('Ordering must be a number.')

    if (editingId.value) {
      await api.put(`/api/admin/categories/${editingId.value}`, body)
    } else {
      await api.post('/api/admin/categories', body)
    }

    emit('refresh')
    resetForm()
  } catch (e: any) {
    error.value = String(e?.message || 'Failed to save category.')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  resetForm()
})

watch(() => props.items.length, () => {
  if (!editingId.value) ordering.value = nextOrdering()
})
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-lg font-semibold text-gray-900">
      Categories
    </h2>
    <p class="text-sm text-gray-600">
      Create categories first. Products and customizations depend on them.
    </p>

    <p v-if="errorMessage" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ errorMessage }}
    </p>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <h3 class="text-sm font-semibold text-gray-900">
          Existing Categories
        </h3>
        <table class="mt-3 w-full text-sm">
          <thead class="text-left text-gray-500">
            <tr><th>Name</th><th>Kind</th><th>Order</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="border-t border-gray-100">
              <td class="py-2">{{ item.name }}</td>
              <td>{{ item.kind || '—' }}</td>
              <td>{{ item.ordering }}</td>
              <td class="text-right">
                <button class="rounded-md border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50" @click="beginEdit(item)">
                  Edit
                </button>
              </td>
            </tr>
            <tr v-if="items.length === 0">
              <td colspan="4" class="py-3 text-gray-500">No categories yet.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <form class="rounded-lg border border-gray-200 bg-white p-4 space-y-3" @submit.prevent="submit">
        <h3 class="text-sm font-semibold text-gray-900">
          {{ editingId ? 'Edit Category' : 'Create Category' }}
        </h3>
        <div>
          <label class="text-sm font-medium text-gray-700">Name</label>
          <input v-model="name" type="text" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage">
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700">Kind (optional)</label>
          <input v-model="kind" type="text" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage">
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700">Ordering</label>
          <input v-model.number="ordering" type="number" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage">
        </div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <div class="flex gap-2">
          <button type="submit" class="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60" :disabled="saving || !canManage">
            {{ saving ? 'Saving…' : (editingId ? 'Update' : 'Create') }}
          </button>
          <button type="button" class="rounded-md border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50" :disabled="saving" @click="resetForm">
            Reset
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

