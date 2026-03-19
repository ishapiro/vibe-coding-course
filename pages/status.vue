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
        <p v-else-if="loading" class="mb-4 text-sm text-gray-400">
          Refreshing...
        </p>

        <section class="grid flex-1 gap-4 lg:grid-cols-4">
          <div class="rounded-lg border border-blue-800 bg-blue-950/20 p-4">
            <h2 class="text-lg font-semibold text-blue-200">Just ordered</h2>
            <p class="mt-1 text-sm text-blue-300">Incoming orders</p>
            <div class="mt-3 space-y-2">
              <div
                v-for="order in groups.new"
                :key="order.id"
                class="rounded-md border border-blue-800/60 bg-gray-900/70 p-3"
              >
                <p class="text-sm font-semibold text-white">{{ order.displayOrderNumber }}</p>
                <p class="text-sm text-gray-300">{{ order.customerName }}</p>
                <p class="mt-1 text-xs text-gray-400">Ordered {{ formatTime(order.createdAt) }}</p>
              </div>
              <p v-if="groups.new.length === 0" class="text-sm text-gray-400">No new orders.</p>
            </div>
          </div>

          <div class="rounded-lg border border-amber-700 bg-amber-950/20 p-4">
            <h2 class="text-lg font-semibold text-amber-200">Orders in preparation</h2>
            <p class="mt-1 text-sm text-amber-300">Currently being prepared</p>
            <div class="mt-3 space-y-2">
              <div
                v-for="order in groups.preparing"
                :key="order.id"
                class="rounded-md border border-amber-700/60 bg-gray-900/70 p-3"
              >
                <p class="text-sm font-semibold text-white">{{ order.displayOrderNumber }}</p>
                <p class="text-sm text-gray-300">{{ order.customerName }}</p>
                <p class="mt-1 text-xs text-gray-400">Updated {{ formatTime(order.updatedAt) }}</p>
              </div>
              <p v-if="groups.preparing.length === 0" class="text-sm text-gray-400">No orders in preparation.</p>
            </div>
          </div>

          <div class="rounded-lg border border-emerald-700 bg-emerald-950/20 p-4">
            <h2 class="text-lg font-semibold text-emerald-200">Ready for Delivery</h2>
            <p class="mt-1 text-sm text-emerald-300">Ready to hand off</p>
            <div class="mt-3 space-y-2">
              <div
                v-for="order in groups.ready"
                :key="order.id"
                class="rounded-md border border-emerald-700/60 bg-gray-900/70 p-3"
              >
                <p class="text-sm font-semibold text-white">{{ order.displayOrderNumber }}</p>
                <p class="text-sm text-gray-300">{{ order.customerName }}</p>
                <p class="mt-1 text-xs text-gray-400">Ready {{ formatTime(order.updatedAt) }}</p>
              </div>
              <p v-if="groups.ready.length === 0" class="text-sm text-gray-400">No ready orders.</p>
            </div>
          </div>

          <div class="rounded-lg border border-violet-700 bg-violet-950/20 p-4">
            <h2 class="text-lg font-semibold text-violet-200">Completed</h2>
            <p class="mt-1 text-sm text-violet-300">Recently completed orders</p>
            <div class="mt-3 space-y-2">
              <div
                v-for="order in groups.completed"
                :key="order.id"
                class="rounded-md border border-violet-700/60 bg-gray-900/70 p-3"
              >
                <p class="text-sm font-semibold text-white">{{ order.displayOrderNumber }}</p>
                <p class="text-sm text-gray-300">{{ order.customerName }}</p>
                <p class="mt-1 text-xs text-gray-400">Completed {{ formatTime(order.updatedAt) }}</p>
              </div>
              <p v-if="groups.completed.length === 0" class="text-sm text-gray-400">No completed orders.</p>
            </div>
          </div>
        </section>
      </template>
    </div>
  </main>
</template>

