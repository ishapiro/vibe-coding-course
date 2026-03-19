<script setup lang="ts">
type Employee = { id: number, name: string, active: boolean }
type Order = { id: number, status: string, createdAt: string, updatedAt: string, customerName?: string, customerEmail?: string | null, displayOrderNumber?: string, deliveredAt?: string | null, preparingEmployeeId?: number | null }

const props = defineProps<{
  items: Order[]
  employees: Employee[]
  canManage: boolean
  errorMessage?: string | null
}>()

const emit = defineEmits<{ refresh: [] }>()
const api = useAdminApi()

const editingId = ref<number | null>(null)
const status = ref('')
const preparingEmployeeId = ref<number | null>(null)
const deliveredAt = ref('')
const saving = ref(false)
const error = ref<string | null>(null)

const employeeMap = computed(() => new Map(props.employees.map(e => [e.id, e.name])))

function beginEdit (item: Order) {
  editingId.value = item.id
  status.value = item.status
  preparingEmployeeId.value = item.preparingEmployeeId ?? null
  deliveredAt.value = item.deliveredAt ? String(item.deliveredAt).slice(0, 16) : ''
  error.value = null
}

function closeEdit () {
  editingId.value = null
  error.value = null
}

async function save () {
  if (!props.canManage || !editingId.value) return
  saving.value = true
  error.value = null
  try {
    const body = {
      status: status.value.trim(),
      preparingEmployeeId: preparingEmployeeId.value,
      deliveredAt: deliveredAt.value ? new Date(deliveredAt.value).toISOString() : null
    }
    if (!body.status) throw new Error('Order status is required.')
    await api.put(`/api/admin/orders/${editingId.value}`, body)
    emit('refresh')
    closeEdit()
  } catch (e: any) {
    error.value = String(e?.message || 'Failed to update order.')
  } finally {
    saving.value = false
  }
}

async function clearAll () {
  if (!props.canManage) return
  if (!confirm('Clear all orders?')) return
  saving.value = true
  error.value = null
  try {
    await api.post('/api/admin/orders/clear')
    emit('refresh')
  } catch (e: any) {
    error.value = String(e?.message || 'Failed to clear orders.')
  } finally {
    saving.value = false
  }
}

async function removeOne (id: number) {
  if (!props.canManage) return
  if (!confirm('Delete this order?')) return
  saving.value = true
  error.value = null
  try {
    await api.del(`/api/admin/orders/${id}`)
    emit('refresh')
  } catch (e: any) {
    error.value = String(e?.message || 'Failed to delete order.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900">Orders</h2>
      <button class="rounded-md border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60" :disabled="!canManage || saving" @click="clearAll">Clear Orders</button>
    </div>
    <p v-if="errorMessage" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{{ errorMessage }}</p>
    <p v-if="error" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

    <div class="rounded-lg border border-gray-200 bg-white p-4">
      <table class="w-full text-sm">
        <thead class="text-left text-gray-500">
          <tr><th>Order</th><th>Status</th><th>Customer</th><th>Preparing</th><th /></tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id" class="border-t border-gray-100">
            <td class="py-2">{{ item.displayOrderNumber || item.id }}</td>
            <td>{{ item.status }}</td>
            <td>{{ item.customerName || '—' }}</td>
            <td>{{ employeeMap.get(item.preparingEmployeeId || -1) || '—' }}</td>
            <td class="text-right space-x-2">
              <button class="rounded-md border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50" :disabled="!canManage" @click="beginEdit(item)">Edit</button>
              <button class="rounded-md border border-red-200 px-3 py-1 text-sm text-red-700 hover:bg-red-50" :disabled="!canManage || saving" @click="removeOne(item.id)">Delete</button>
            </td>
          </tr>
          <tr v-if="items.length===0"><td colspan="5" class="py-3 text-gray-500">No orders yet.</td></tr>
        </tbody>
      </table>
    </div>

    <div v-if="editingId" class="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <h3 class="text-sm font-semibold text-gray-900">Edit Order #{{ editingId }}</h3>
      <div><label class="text-sm font-medium text-gray-700">Status</label><input v-model="status" type="text" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving" /></div>
      <div>
        <label class="text-sm font-medium text-gray-700">Preparing employee</label>
        <select v-model="preparingEmployeeId" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving">
          <option :value="null">None</option>
          <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.name }} ({{ e.id }})</option>
        </select>
      </div>
      <div><label class="text-sm font-medium text-gray-700">Delivered at</label><input v-model="deliveredAt" type="datetime-local" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving" /></div>
      <div class="flex gap-2">
        <button class="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Update Order' }}</button>
        <button class="rounded-md border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50" :disabled="saving" @click="closeEdit">Cancel</button>
      </div>
    </div>
  </section>
</template>

