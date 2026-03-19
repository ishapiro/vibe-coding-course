<script setup lang="ts">
type Employee = {
  id: number
  name: string
  active: boolean
}

type StationLineItem = {
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

type StationOrder = {
  id: number
  status: 'new' | 'preparing' | 'ready' | 'completed'
  customerName: string
  customerEmail: string | null
  displayOrderNumber: string
  preparingEmployeeId: number | null
  preparingEmployeeName: string | null
  createdAt: string
  updatedAt: string
  lineItems: StationLineItem[]
}

const { stationPassword, setAuthenticated, clearRole } = useAuth()

const passwordInput = ref('')
const verifying = ref(false)
const checkedSession = ref(false)
const verified = ref(false)
const authError = ref('')

const loadingEmployees = ref(false)
const employeesError = ref('')
const employees = ref<Employee[]>([])
const selectedEmployeeId = ref<number | null>(null)
const confirmedEmployee = ref<Employee | null>(null)
const loadingOrders = ref(false)
const ordersError = ref('')
const orders = ref<StationOrder[]>([])
const selectedOrderId = ref<number | null>(null)
const finishingOrder = ref(false)
const finishMessage = ref('')

async function verifyPassword (password: string) {
  const response = await fetch('/api/check-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'station',
      password
    })
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.ok) {
    throw new Error('Incorrect station password.')
  }
}

async function loadEmployees () {
  if (!stationPassword.value) {
    throw new Error('Missing station password.')
  }

  loadingEmployees.value = true
  employeesError.value = ''

  try {
    const response = await fetch('/api/station/employees', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-station-password': stationPassword.value
      }
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(
        typeof data?.message === 'string'
          ? data.message
          : (typeof data?.error === 'string' ? data.error : 'Failed to load employees.')
      )
    }

    employees.value = Array.isArray(data?.items)
      ? data.items.filter((item: any) => item && item.active)
      : []

    if (employees.value.length > 0 && selectedEmployeeId.value === null) {
      selectedEmployeeId.value = employees.value[0].id
    }
  } catch (error: any) {
    employeesError.value = String(error?.message || 'Unable to load employees.')
  } finally {
    loadingEmployees.value = false
  }
}

async function loadOrders () {
  if (!stationPassword.value) {
    throw new Error('Missing station password.')
  }

  loadingOrders.value = true
  ordersError.value = ''

  try {
    const response = await fetch('/api/station/orders', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-station-password': stationPassword.value
      }
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(
        typeof data?.message === 'string'
          ? data.message
          : (typeof data?.error === 'string' ? data.error : 'Failed to load orders.')
      )
    }

    orders.value = Array.isArray(data?.items) ? data.items : []
  } catch (error: any) {
    ordersError.value = String(error?.message || 'Unable to load orders.')
  } finally {
    loadingOrders.value = false
  }
}

async function submitPasswordLogin () {
  if (!passwordInput.value.trim()) {
    authError.value = 'Please enter the station password.'
    return
  }

  verifying.value = true
  authError.value = ''

  try {
    await verifyPassword(passwordInput.value)
    setAuthenticated('station', passwordInput.value)
    verified.value = true
    passwordInput.value = ''
    await loadEmployees()
  } catch (error: any) {
    authError.value = String(error?.message || 'Unable to verify station password.')
  } finally {
    verifying.value = false
  }
}

async function bootstrapWithStoredSession () {
  if (!stationPassword.value) {
    checkedSession.value = true
    return
  }

  try {
    await verifyPassword(stationPassword.value)
    verified.value = true
    await loadEmployees()
  } catch {
    clearRole('station')
    verified.value = false
  } finally {
    checkedSession.value = true
  }
}

function confirmEmployee () {
  const selected = employees.value.find(employee => employee.id === selectedEmployeeId.value) || null
  if (!selected) {
    employeesError.value = 'Please choose an employee before continuing.'
    return
  }
  confirmedEmployee.value = selected
  employeesError.value = ''
  selectedOrderId.value = null
  finishMessage.value = ''
  loadOrders()
}

function changeEmployee () {
  confirmedEmployee.value = null
  selectedOrderId.value = null
  finishMessage.value = ''
}

const availableOrders = computed(() =>
  orders.value.filter(order => order.status !== 'completed')
)

const selectedOrder = computed(() =>
  availableOrders.value.find(order => order.id === selectedOrderId.value) || null
)

function formatDollars (value: number) {
  return `$${value.toFixed(2)}`
}

function formatOrderStatus (status: StationOrder['status']) {
  if (status === 'new') return 'New'
  if (status === 'preparing') return 'Preparing'
  if (status === 'ready') return 'Ready'
  return 'Completed'
}

function lineItemTotal (lineItem: StationLineItem) {
  return lineItem.unitPrice * lineItem.quantity
}

function orderItemCount (order: StationOrder) {
  return order.lineItems.reduce((sum, item) => sum + item.quantity, 0)
}

function orderTotal (order: StationOrder) {
  return order.lineItems.reduce((sum, item) => sum + lineItemTotal(item), 0)
}

function nextStatusFor (status: StationOrder['status']) {
  if (status === 'new') return 'preparing'
  if (status === 'preparing') return 'ready'
  if (status === 'ready') return 'delivered'
  return null
}

async function finishSelectedOrder () {
  if (!selectedOrder.value || !confirmedEmployee.value || !stationPassword.value) {
    return
  }

  const nextStatus = nextStatusFor(selectedOrder.value.status)
  if (!nextStatus) {
    finishMessage.value = 'This order is already completed.'
    return
  }

  finishingOrder.value = true
  ordersError.value = ''
  finishMessage.value = ''

  try {
    const response = await fetch(`/api/station/orders/${selectedOrder.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-station-password': stationPassword.value
      },
      body: JSON.stringify({
        status: nextStatus,
        preparingEmployeeId: confirmedEmployee.value.id
      })
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.ok) {
      throw new Error(
        typeof data?.error === 'string'
          ? data.error
          : 'Failed to update order.'
      )
    }

    const updatedNumber =
      typeof selectedOrder.value.displayOrderNumber === 'string'
        ? selectedOrder.value.displayOrderNumber
        : 'Order'

    await loadOrders()
    selectedOrderId.value = null
    finishMessage.value = `${updatedNumber} moved to ${nextStatus}. Select another order to work on.`
  } catch (error: any) {
    ordersError.value = String(error?.message || 'Unable to move order to the next status.')
  } finally {
    finishingOrder.value = false
  }
}

onMounted(() => {
  bootstrapWithStoredSession()
})
</script>

<template>
  <main class="min-h-screen bg-white px-4 py-8">
    <section class="mx-auto w-full max-w-3xl">
      <h1 class="text-3xl font-bold text-gray-900">
        Order Processing Station
      </h1>
      <p class="mt-2 text-gray-700">
        Station staff login and employee sign-in.
      </p>

      <div v-if="!verified" class="mt-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 class="text-lg font-semibold text-gray-900">
          Station Access
        </h2>
        <p class="mt-1 text-sm text-gray-600">
          Enter the station password to continue.
        </p>

        <p v-if="!checkedSession" class="mt-3 text-sm text-gray-500">
          Checking saved station session...
        </p>

        <form class="mt-4 space-y-3" @submit.prevent="submitPasswordLogin">
          <div>
            <label class="text-sm font-medium text-gray-700">Station password</label>
            <input
              v-model="passwordInput"
              type="password"
              autocomplete="off"
              class="mt-1 block w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand"
              :disabled="verifying || !checkedSession"
            />
          </div>
          <p v-if="authError" class="text-sm text-red-600">
            {{ authError }}
          </p>
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            :disabled="verifying || !checkedSession"
          >
            <span v-if="verifying">Verifying...</span>
            <span v-else>Unlock Station</span>
          </button>
        </form>
      </div>

      <div v-else class="mt-6 space-y-4">
        <div class="rounded-lg border border-gray-200 bg-white p-5">
          <h2 class="text-lg font-semibold text-gray-900">
            Employee Sign-in
          </h2>
          <p class="mt-1 text-sm text-gray-600">
            Choose your name and confirm to start your station session.
          </p>

          <p v-if="loadingEmployees" class="mt-3 text-sm text-gray-500">
            Loading employees...
          </p>

          <div v-else-if="!confirmedEmployee" class="mt-4 space-y-3">
            <div>
              <label class="text-sm font-medium text-gray-700">Employee name</label>
              <select
                v-model.number="selectedEmployeeId"
                class="mt-1 block w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand"
                :disabled="employees.length === 0"
              >
                <option
                  v-for="employee in employees"
                  :key="employee.id"
                  :value="employee.id"
                >
                  {{ employee.name }}
                </option>
              </select>
            </div>
            <p v-if="employees.length === 0" class="text-sm text-amber-700">
              No active employees available. Add or activate employees in admin.
            </p>
            <p v-if="employeesError" class="text-sm text-red-600">
              {{ employeesError }}
            </p>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
              :disabled="employees.length === 0"
              @click="confirmEmployee"
            >
              Confirm
            </button>
          </div>

          <div v-else class="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3">
            <p class="text-sm font-medium text-green-800">
              Signed in as {{ confirmedEmployee.name }}
            </p>
            <button
              type="button"
              class="mt-2 inline-flex items-center justify-center rounded-md border border-green-300 bg-white px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100"
              @click="changeEmployee"
            >
              Change
            </button>
          </div>
        </div>

        <div v-if="confirmedEmployee" class="rounded-lg border border-gray-200 bg-white p-5">
          <h2 class="text-lg font-semibold text-gray-900">
            Available Orders
          </h2>
          <p class="mt-1 text-sm text-gray-600">
            Select an order that has not been delivered and process it for your station.
          </p>

          <p v-if="loadingOrders" class="mt-3 text-sm text-gray-500">
            Loading orders...
          </p>
          <p v-if="ordersError" class="mt-3 text-sm text-red-600">
            {{ ordersError }}
          </p>
          <p v-if="finishMessage" class="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {{ finishMessage }}
          </p>

          <div v-if="!loadingOrders && availableOrders.length > 0" class="mt-4 grid gap-3 md:grid-cols-2">
            <button
              v-for="order in availableOrders"
              :key="order.id"
              type="button"
              class="rounded-md border px-3 py-3 text-left"
              :class="selectedOrderId === order.id
                ? 'border-brand bg-blue-50'
                : 'border-gray-300 bg-white hover:bg-gray-50'"
              @click="selectedOrderId = order.id"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-semibold text-gray-900">{{ order.displayOrderNumber }}</p>
                <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {{ formatOrderStatus(order.status) }}
                </span>
              </div>
              <p class="mt-1 text-sm text-gray-800">{{ order.customerName }}</p>
              <p class="mt-1 text-xs text-gray-600">
                {{ orderItemCount(order) }} items · {{ formatDollars(orderTotal(order)) }}
              </p>
              <p v-if="order.preparingEmployeeName" class="mt-1 text-xs text-gray-500">
                Assigned: {{ order.preparingEmployeeName }}
              </p>
            </button>
          </div>
          <p v-else-if="!loadingOrders" class="mt-3 text-sm text-gray-500">
            No active orders to work on right now.
          </p>
        </div>

        <div v-if="selectedOrder" class="rounded-lg border border-gray-200 bg-white p-5">
          <h2 class="text-lg font-semibold text-gray-900">
            Order Details: {{ selectedOrder.displayOrderNumber }}
          </h2>
          <p class="mt-1 text-sm text-gray-700">
            Customer: {{ selectedOrder.customerName }}
            <span v-if="selectedOrder.customerEmail">({{ selectedOrder.customerEmail }})</span>
          </p>
          <p class="mt-1 text-sm text-gray-700">
            Status: <span class="font-medium">{{ formatOrderStatus(selectedOrder.status) }}</span>
          </p>

          <div class="mt-4 space-y-3">
            <div
              v-for="lineItem in selectedOrder.lineItems"
              :key="lineItem.id"
              class="rounded-md border border-gray-200 bg-gray-50 p-3"
            >
              <div class="flex items-center justify-between gap-3">
                <p class="text-sm font-semibold text-gray-900">
                  {{ lineItem.quantity }}x {{ lineItem.productName }}
                </p>
                <p class="text-sm font-semibold text-gray-900">
                  {{ formatDollars(lineItemTotal(lineItem)) }}
                </p>
              </div>
              <p class="mt-1 text-xs text-gray-600">
                Unit price: {{ formatDollars(lineItem.unitPrice) }}
              </p>
              <ul v-if="lineItem.customizations.length > 0" class="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-700">
                <li
                  v-for="(customization, idx) in lineItem.customizations"
                  :key="`${lineItem.id}-${idx}`"
                >
                  {{ customization.label || 'Customization' }}: {{ customization.option || 'Selected' }}
                </li>
              </ul>
              <p v-else class="mt-2 text-xs text-gray-500">
                No customizations.
              </p>
            </div>
          </div>

          <div class="mt-5 border-t border-gray-200 pt-4">
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              :disabled="finishingOrder"
              @click="finishSelectedOrder"
            >
              <span v-if="finishingOrder">Finishing...</span>
              <span v-else>Finished</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

