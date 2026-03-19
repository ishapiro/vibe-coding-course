<script setup lang="ts">
definePageMeta({ layout: false })

type StatusOrder = {
  id: number
  status: string
  customerName: string
  displayOrderNumber: string
  createdAt: string
  updatedAt: string
}

type OrderDetailLineItem = {
  id: number
  productId: number
  productName: string
  quantity: number
  unitPrice: number
  customizations: Array<{
    customizationId?: number
    label?: string
    option?: string
  }>
}

type StatusApiResponse = {
  summary?: {
    total?: number
    new?: number
    preparing?: number
    ready?: number
    completed?: number
  }
  groups?: {
    new?: StatusOrder[]
    preparing?: StatusOrder[]
    ready?: StatusOrder[]
    completed?: StatusOrder[]
  }
}

const { adminPassword, setAuthenticated, clearRole } = useAuth()

const passwordInput = ref('')
const verifying = ref(false)
const loading = ref(false)
const checkedSession = ref(false)
const verified = ref(false)
const authError = ref('')
const boardError = ref('')
const actionError = ref('')
const updatingOrderIds = ref<number[]>([])
const detailsLoading = ref(false)
const detailsError = ref('')
const selectedOrderDetails = ref<{
  order: StatusOrder
  lineItems: OrderDetailLineItem[]
} | null>(null)

const summary = ref({
  total: 0,
  new: 0,
  preparing: 0,
  ready: 0,
  completed: 0
})

const groups = ref({
  new: [] as StatusOrder[],
  preparing: [] as StatusOrder[],
  ready: [] as StatusOrder[],
  completed: [] as StatusOrder[]
})

let pollTimer: ReturnType<typeof setInterval> | null = null

function stopPolling () {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function verifyPassword (password: string) {
  const response = await fetch('/api/check-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'admin', password })
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.ok) {
    throw new Error('Incorrect admin password.')
  }
}

async function fetchStatusData () {
  if (!adminPassword.value) {
    throw new Error('Missing admin password.')
  }

  const response = await fetch('/api/admin/orders/status', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-admin-password': adminPassword.value
    }
  })
  const data = await response.json().catch(() => ({} as StatusApiResponse))
  if (!response.ok) {
    throw new Error(
      (data as any)?.message ||
      (data as any)?.error ||
      'Failed to load status data.'
    )
  }

  const safeData = data as StatusApiResponse

  summary.value = {
    total: Number(safeData.summary?.total ?? 0),
    new: Number(safeData.summary?.new ?? 0),
    preparing: Number(safeData.summary?.preparing ?? 0),
    ready: Number(safeData.summary?.ready ?? 0),
    completed: Number(safeData.summary?.completed ?? 0)
  }

  groups.value = {
    new: Array.isArray(safeData.groups?.new) ? safeData.groups!.new! : [],
    preparing: Array.isArray(safeData.groups?.preparing) ? safeData.groups!.preparing! : [],
    ready: Array.isArray(safeData.groups?.ready) ? safeData.groups!.ready! : [],
    completed: Array.isArray(safeData.groups?.completed) ? safeData.groups!.completed! : []
  }
}

async function refreshBoard () {
  loading.value = true
  boardError.value = ''
  try {
    await fetchStatusData()
  } catch (error: any) {
    boardError.value = String(error?.message || 'Unable to refresh status board.')
    const message = boardError.value.toLowerCase()
    if (message.includes('unauthorized') || message.includes('credential') || message.includes('password')) {
      verified.value = false
      clearRole('admin')
      stopPolling()
    }
  } finally {
    loading.value = false
  }
}

function isUpdatingOrder (orderId: number) {
  return updatingOrderIds.value.includes(orderId)
}

function formatCurrency (value: number) {
  return `$${value.toFixed(2)}`
}

async function updateOrderStatus (order: StatusOrder, nextStatus: 'new' | 'preparing' | 'ready' | 'delivered') {
  if (!adminPassword.value || isUpdatingOrder(order.id)) {
    return
  }

  actionError.value = ''
  updatingOrderIds.value = [...updatingOrderIds.value, order.id]

  try {
    const response = await fetch(`/api/admin/orders/${order.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': adminPassword.value
      },
      body: JSON.stringify({
        status: nextStatus,
        deliveredAt: nextStatus === 'delivered' ? new Date().toISOString() : null
      })
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.ok) {
      throw new Error(
        typeof data?.error === 'string'
          ? data.error
          : 'Failed to update order status.'
      )
    }

    await refreshBoard()
  } catch (error: any) {
    actionError.value = String(error?.message || 'Unable to update order status.')
  } finally {
    updatingOrderIds.value = updatingOrderIds.value.filter(id => id !== order.id)
  }
}

async function openOrderDetails (order: StatusOrder) {
  if (!adminPassword.value) return

  detailsLoading.value = true
  detailsError.value = ''
  selectedOrderDetails.value = null

  try {
    const response = await fetch(`/api/admin/orders/${order.id}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-admin-password': adminPassword.value
      }
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.ok) {
      throw new Error(
        typeof data?.error === 'string'
          ? data.error
          : 'Failed to load order details.'
      )
    }

    selectedOrderDetails.value = {
      order,
      lineItems: Array.isArray(data?.lineItems) ? data.lineItems : []
    }
  } catch (error: any) {
    detailsError.value = String(error?.message || 'Unable to load order details.')
  } finally {
    detailsLoading.value = false
  }
}

function closeOrderDetails () {
  selectedOrderDetails.value = null
  detailsError.value = ''
}

function startPolling () {
  stopPolling()
  pollTimer = setInterval(() => {
    refreshBoard()
  }, 5000)
}

async function submitLogin () {
  if (!passwordInput.value.trim()) {
    authError.value = 'Please enter the admin password.'
    return
  }

  verifying.value = true
  authError.value = ''
  try {
    await verifyPassword(passwordInput.value)
    setAuthenticated('admin', passwordInput.value)
    verified.value = true
    passwordInput.value = ''
    await refreshBoard()
    startPolling()
  } catch (error: any) {
    authError.value = String(error?.message || 'Unable to verify password.')
  } finally {
    verifying.value = false
  }
}

async function bootstrapWithStoredSession () {
  if (!adminPassword.value) {
    checkedSession.value = true
    return
  }

  try {
    await verifyPassword(adminPassword.value)
    verified.value = true
    await refreshBoard()
    startPolling()
  } catch {
    clearRole('admin')
    verified.value = false
  } finally {
    checkedSession.value = true
  }
}

function formatTime (value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  bootstrapWithStoredSession()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <main class="min-h-screen bg-gray-950 text-gray-100">
    <div class="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col px-6 py-6">
      <section
        v-if="!verified"
        class="mx-auto my-auto w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-xl"
      >
        <h1 class="text-2xl font-bold text-white">
          Status Board Access
        </h1>
        <p class="mt-2 text-sm text-gray-300">
          Enter admin password to view live order statuses.
        </p>
        <p v-if="!checkedSession" class="mt-3 text-sm text-gray-400">
          Checking existing session...
        </p>

        <form class="mt-4 space-y-3" @submit.prevent="submitLogin">
          <div>
            <label class="text-sm font-medium text-gray-200">Admin password</label>
            <input
              v-model="passwordInput"
              type="password"
              autocomplete="off"
              class="mt-1 block w-full rounded-md border border-gray-700 bg-gray-950 text-gray-100 focus:border-blue-500 focus:ring-blue-500"
              :disabled="verifying || !checkedSession"
            />
          </div>
          <p v-if="authError" class="text-sm text-red-400">
            {{ authError }}
          </p>
          <button
            type="submit"
            class="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            :disabled="verifying || !checkedSession"
          >
            <span v-if="verifying">Verifying...</span>
            <span v-else>Open Status Board</span>
          </button>
        </form>
      </section>

      <template v-else>
        <header class="mb-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-3xl font-bold tracking-tight text-white">
              Live Order Status Board
            </h1>
            <p class="text-sm text-gray-400">
              Auto-refresh every 5 seconds
            </p>
          </div>

          <div class="mt-4 grid gap-3 md:grid-cols-5">
            <div class="rounded-md border border-gray-700 bg-gray-900 px-3 py-2">
              <p class="text-xs uppercase tracking-wide text-gray-400">Total</p>
              <p class="text-2xl font-semibold text-white">{{ summary.total }}</p>
            </div>
            <div class="rounded-md border border-blue-800 bg-blue-950/40 px-3 py-2">
              <p class="text-xs uppercase tracking-wide text-blue-300">New</p>
              <p class="text-2xl font-semibold text-blue-200">{{ summary.new }}</p>
            </div>
            <div class="rounded-md border border-amber-700 bg-amber-950/35 px-3 py-2">
              <p class="text-xs uppercase tracking-wide text-amber-300">Preparing</p>
              <p class="text-2xl font-semibold text-amber-200">{{ summary.preparing }}</p>
            </div>
            <div class="rounded-md border border-emerald-700 bg-emerald-950/35 px-3 py-2">
              <p class="text-xs uppercase tracking-wide text-emerald-300">Ready</p>
              <p class="text-2xl font-semibold text-emerald-200">{{ summary.ready }}</p>
            </div>
            <div class="rounded-md border border-violet-700 bg-violet-950/35 px-3 py-2">
              <p class="text-xs uppercase tracking-wide text-violet-300">Completed</p>
              <p class="text-2xl font-semibold text-violet-200">{{ summary.completed }}</p>
            </div>
          </div>
        </header>

        <p
          v-if="boardError"
          class="mb-4 rounded-md border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300"
        >
          {{ boardError }}
        </p>
        <p
          v-if="actionError"
          class="mb-4 rounded-md border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300"
        >
          {{ actionError }}
        </p>
        <p v-else-if="loading" class="mb-4 text-sm text-gray-400">
          Refreshing...
        </p>

        <section class="grid flex-1 gap-4 lg:grid-cols-4">
          <div class="flex min-h-0 flex-col rounded-lg border border-blue-800 bg-blue-950/20 p-4">
            <h2 class="text-lg font-semibold text-blue-200">Just ordered</h2>
            <p class="mt-1 text-sm text-blue-300">Incoming orders</p>
            <div class="status-scroll mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
              <div
                v-for="order in groups.new"
                :key="order.id"
                class="rounded-md border border-blue-800/60 bg-gray-900/70 p-3"
              >
                <p class="text-sm font-semibold text-white">{{ order.displayOrderNumber }}</p>
                <p class="text-sm text-gray-300">{{ order.customerName }}</p>
                <p class="mt-1 text-xs text-gray-400">Ordered {{ formatTime(order.createdAt) }}</p>
                <div class="mt-2">
                  <button
                    type="button"
                    class="mr-2 rounded-md border border-blue-500 bg-transparent px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-900/40"
                    @click="openOrderDetails(order)"
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                    :disabled="isUpdatingOrder(order.id)"
                    @click="updateOrderStatus(order, 'preparing')"
                  >
                    <span v-if="isUpdatingOrder(order.id)">Updating...</span>
                    <span v-else>Move to Preparing</span>
                  </button>
                </div>
              </div>
              <p v-if="groups.new.length === 0" class="text-sm text-gray-400">No new orders.</p>
            </div>
          </div>

          <div class="flex min-h-0 flex-col rounded-lg border border-amber-700 bg-amber-950/20 p-4">
            <h2 class="text-lg font-semibold text-amber-200">Orders in preparation</h2>
            <p class="mt-1 text-sm text-amber-300">Currently being prepared</p>
            <div class="status-scroll mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
              <div
                v-for="order in groups.preparing"
                :key="order.id"
                class="rounded-md border border-amber-700/60 bg-gray-900/70 p-3"
              >
                <p class="text-sm font-semibold text-white">{{ order.displayOrderNumber }}</p>
                <p class="text-sm text-gray-300">{{ order.customerName }}</p>
                <p class="mt-1 text-xs text-gray-400">Updated {{ formatTime(order.updatedAt) }}</p>
                <div class="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-md border border-amber-500 bg-transparent px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/40"
                    @click="openOrderDetails(order)"
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    class="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                    :disabled="isUpdatingOrder(order.id)"
                    @click="updateOrderStatus(order, 'ready')"
                  >
                    <span v-if="isUpdatingOrder(order.id)">Updating...</span>
                    <span v-else>Move to Ready</span>
                  </button>
                  <button
                    type="button"
                    class="rounded-md border border-amber-500 bg-transparent px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/40 disabled:opacity-60"
                    :disabled="isUpdatingOrder(order.id)"
                    @click="updateOrderStatus(order, 'new')"
                  >
                    Move Back
                  </button>
                </div>
              </div>
              <p v-if="groups.preparing.length === 0" class="text-sm text-gray-400">No orders in preparation.</p>
            </div>
          </div>

          <div class="flex min-h-0 flex-col rounded-lg border border-emerald-700 bg-emerald-950/20 p-4">
            <h2 class="text-lg font-semibold text-emerald-200">Ready for Delivery</h2>
            <p class="mt-1 text-sm text-emerald-300">Ready to hand off</p>
            <div class="status-scroll mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
              <div
                v-for="order in groups.ready"
                :key="order.id"
                class="rounded-md border border-emerald-700/60 bg-gray-900/70 p-3"
              >
                <p class="text-sm font-semibold text-white">{{ order.displayOrderNumber }}</p>
                <p class="text-sm text-gray-300">{{ order.customerName }}</p>
                <p class="mt-1 text-xs text-gray-400">Ready {{ formatTime(order.updatedAt) }}</p>
                <div class="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-md border border-emerald-500 bg-transparent px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40"
                    @click="openOrderDetails(order)"
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    :disabled="isUpdatingOrder(order.id)"
                    @click="updateOrderStatus(order, 'delivered')"
                  >
                    <span v-if="isUpdatingOrder(order.id)">Updating...</span>
                    <span v-else>Mark Delivered</span>
                  </button>
                  <button
                    type="button"
                    class="rounded-md border border-emerald-500 bg-transparent px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-60"
                    :disabled="isUpdatingOrder(order.id)"
                    @click="updateOrderStatus(order, 'preparing')"
                  >
                    Move Back
                  </button>
                </div>
              </div>
              <p v-if="groups.ready.length === 0" class="text-sm text-gray-400">No ready orders.</p>
            </div>
          </div>

          <div class="flex min-h-0 flex-col rounded-lg border border-violet-700 bg-violet-950/20 p-4">
            <h2 class="text-lg font-semibold text-violet-200">Completed</h2>
            <p class="mt-1 text-sm text-violet-300">Recently completed orders</p>
            <div class="status-scroll mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
              <div
                v-for="order in groups.completed"
                :key="order.id"
                class="rounded-md border border-violet-700/60 bg-gray-900/70 p-3"
              >
                <p class="text-sm font-semibold text-white">{{ order.displayOrderNumber }}</p>
                <p class="text-sm text-gray-300">{{ order.customerName }}</p>
                <p class="mt-1 text-xs text-gray-400">Completed {{ formatTime(order.updatedAt) }}</p>
                <div class="mt-2">
                  <button
                    type="button"
                    class="rounded-md border border-violet-500 bg-transparent px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-900/40"
                    @click="openOrderDetails(order)"
                  >
                    Details
                  </button>
                </div>
              </div>
              <p v-if="groups.completed.length === 0" class="text-sm text-gray-400">No completed orders.</p>
            </div>
          </div>
        </section>
      </template>
    </div>

    <div
      v-if="selectedOrderDetails || detailsLoading || detailsError"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Order details"
    >
      <div class="w-full max-w-2xl rounded-lg border border-gray-700 bg-gray-900 p-5 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-xl font-semibold text-white">Order Details</h2>
            <p v-if="selectedOrderDetails" class="mt-1 text-sm text-gray-300">
              {{ selectedOrderDetails.order.displayOrderNumber }} - {{ selectedOrderDetails.order.customerName }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-md border border-gray-600 bg-gray-800 px-3 py-1 text-sm font-medium text-gray-100 hover:bg-gray-700"
            @click="closeOrderDetails"
          >
            Close
          </button>
        </div>

        <p v-if="detailsLoading" class="mt-4 text-sm text-gray-300">Loading order details...</p>
        <p v-else-if="detailsError" class="mt-4 text-sm text-red-400">{{ detailsError }}</p>

        <div v-else-if="selectedOrderDetails" class="mt-4 max-h-[60vh] overflow-y-auto pr-2">
          <div
            v-for="lineItem in selectedOrderDetails.lineItems"
            :key="lineItem.id"
            class="mb-3 rounded-md border border-gray-700 bg-gray-950 p-3"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-white">
                {{ lineItem.quantity }}x {{ lineItem.productName }}
              </p>
              <p class="text-sm font-semibold text-gray-200">
                {{ formatCurrency(lineItem.unitPrice * lineItem.quantity) }}
              </p>
            </div>
            <p class="mt-1 text-xs text-gray-400">
              Unit price: {{ formatCurrency(lineItem.unitPrice) }}
            </p>
            <ul v-if="lineItem.customizations.length > 0" class="mt-2 space-y-1 text-xs text-gray-300">
              <li
                v-for="(customization, idx) in lineItem.customizations"
                :key="`${lineItem.id}-${idx}`"
              >
                {{ customization.label || 'Customization' }}: {{ customization.option || 'Selected' }}
              </li>
            </ul>
            <p v-else class="mt-2 text-xs text-gray-500">No customizations.</p>
          </div>
          <p v-if="selectedOrderDetails.lineItems.length === 0" class="text-sm text-gray-400">
            No line items found for this order.
          </p>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.status-scroll {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: auto;
  scrollbar-color: #64748b #111827;
}

.status-scroll::-webkit-scrollbar {
  width: 14px;
}

.status-scroll::-webkit-scrollbar-track {
  background: #111827;
  border-radius: 9999px;
}

.status-scroll::-webkit-scrollbar-thumb {
  background: #64748b;
  border-radius: 9999px;
  border: 3px solid #111827;
}

.status-scroll::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>

