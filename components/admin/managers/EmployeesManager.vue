<script setup lang="ts">
type Employee = { id: number, name: string, active: boolean }

const props = defineProps<{
  items: Employee[]
  canManage: boolean
  errorMessage?: string | null
}>()

const emit = defineEmits<{ refresh: [] }>()
const api = useAdminApi()

const editingId = ref<number | null>(null)
const name = ref('')
const active = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)

function resetForm () {
  editingId.value = null
  name.value = ''
  active.value = true
  error.value = null
}

function beginEdit (item: Employee) {
  editingId.value = item.id
  name.value = item.name
  active.value = item.active
  error.value = null
}

async function submit () {
  if (!props.canManage) return
  error.value = null
  saving.value = true
  try {
    const body = { name: name.value.trim(), active: active.value }
    if (!body.name) throw new Error('Employee name is required.')
    if (editingId.value) await api.put(`/api/admin/employees/${editingId.value}`, body)
    else await api.post('/api/admin/employees', body)
    emit('refresh')
    resetForm()
  } catch (e: any) {
    error.value = String(e?.message || 'Failed to save employee.')
  } finally {
    saving.value = false
  }
}

onMounted(resetForm)
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-lg font-semibold text-gray-900">Employees</h2>
    <p v-if="errorMessage" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{{ errorMessage }}</p>
    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <h3 class="text-sm font-semibold text-gray-900">Existing Employees</h3>
        <table class="mt-3 w-full text-sm">
          <thead class="text-left text-gray-500"><tr><th>Name</th><th>Status</th><th /></tr></thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="border-t border-gray-100">
              <td class="py-2">{{ item.name }}</td><td>{{ item.active ? 'Active' : 'Inactive' }}</td>
              <td class="text-right"><button class="rounded-md border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50" :disabled="!canManage" @click="beginEdit(item)">Edit</button></td>
            </tr>
            <tr v-if="items.length===0"><td colspan="3" class="py-3 text-gray-500">No employees yet.</td></tr>
          </tbody>
        </table>
      </div>
      <form class="rounded-lg border border-gray-200 bg-white p-4 space-y-3" @submit.prevent="submit">
        <h3 class="text-sm font-semibold text-gray-900">{{ editingId ? 'Edit Employee' : 'Create Employee' }}</h3>
        <div><label class="text-sm font-medium text-gray-700">Name</label><input v-model="name" type="text" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage"></div>
        <label class="inline-flex items-center gap-2 text-sm text-gray-700"><input v-model="active" type="checkbox" :disabled="saving || !canManage"> Active</label>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <div class="flex gap-2">
          <button type="submit" class="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60" :disabled="saving || !canManage">{{ saving ? 'Saving…' : (editingId ? 'Update' : 'Create') }}</button>
          <button type="button" class="rounded-md border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50" :disabled="saving" @click="resetForm">Reset</button>
        </div>
      </form>
    </div>
  </section>
</template>

