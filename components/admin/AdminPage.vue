<script setup lang="ts">
import type { LocationQueryValue } from 'vue-router'
import CategoriesManager from '~/components/admin/managers/CategoriesManager.vue'
import ProductsManager from '~/components/admin/managers/ProductsManager.vue'
import CustomizationsManager from '~/components/admin/managers/CustomizationsManager.vue'
import EmployeesManager from '~/components/admin/managers/EmployeesManager.vue'
import SystemSettingsManager from '~/components/admin/managers/SystemSettingsManager.vue'
import OrdersManager from '~/components/admin/managers/OrdersManager.vue'

type AdminSection = 'categories' | 'products' | 'customizations' | 'employees' | 'settings' | 'orders'
type Category = { id: number, name: string, ordering: number, kind: string | null }
type Product = { id: number, categoryId: number, name: string, description: string | null, price: number, ordering: number }
type Customization = { id: number, categoryId: number | null, productId: number | null, label: string, kind: string, options: string | null, ordering: number }
type Employee = { id: number, name: string, active: boolean }
type Setting = { key: string, value: string }
type Order = { id: number, status: string, createdAt: string, updatedAt: string, customerName?: string, customerEmail?: string | null, displayOrderNumber?: string, deliveredAt?: string | null, preparingEmployeeId?: number | null }

const props = defineProps<{ section?: AdminSection }>()

const auth = useAuth()
const api = useAdminApi()
const route = useRoute()

const verified = useState<boolean>('admin-verified', () => false)

const password = ref('')
const loginBusy = ref(false)
const loginError = ref<string | null>(null)
const loadError = ref<string | null>(null)
const loading = ref(false)

const categories = ref<Category[]>([])
const products = ref<Product[]>([])
const customizations = ref<Customization[]>([])
const employees = ref<Employee[]>([])
const settings = ref<Setting[]>([])
const orders = ref<Order[]>([])

const activeSection = computed<AdminSection>(() => props.section ?? 'categories')
const coreReady = computed(() => categories.value.length > 0 && products.value.length > 0)

const canManage = computed(() => ({
  categories: true,
  products: categories.value.length > 0,
  customizations: coreReady.value,
  employees: coreReady.value,
  settings: coreReady.value,
  orders: coreReady.value
}))

const sectionMessage = computed(() => ({
  products: canManage.value.products ? null : 'Create at least one category first.',
  customizations: canManage.value.customizations ? null : 'Create categories and products first.',
  employees: canManage.value.employees ? null : 'Create categories and products first.',
  settings: canManage.value.settings ? null : 'Create categories and products first.',
  orders: canManage.value.orders ? null : 'Create categories and products first.'
}))

const nextAfterLogin = computed(() => {
  const q = route.query.next as LocationQueryValue | LocationQueryValue[] | undefined
  if (!q || Array.isArray(q)) return '/admin'
  const v = String(q)
  return v.startsWith('/admin') ? v : '/admin'
})

async function verifyPassword (candidate: string): Promise<boolean> {
  const response = await fetch('/api/check-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'admin', password: candidate })
  })
  const payload = await response.json().catch(() => ({}))
  return !!(response.ok && payload?.ok)
}

async function login () {
  loginError.value = null
  loginBusy.value = true
  try {
    const candidate = password.value
    if (!candidate.trim()) throw new Error('Please enter the admin password.')
    const ok = await verifyPassword(candidate)
    if (!ok) throw new Error('Invalid admin password.')

    auth.setAuthenticated('admin', candidate)
    verified.value = true
    await loadAll()
    await navigateTo(nextAfterLogin.value, { replace: true })
  } catch (e: any) {
    loginError.value = String(e?.message || 'Login failed.')
  } finally {
    loginBusy.value = false
  }
}

function logout () {
  auth.clearRole('admin')
  verified.value = false
  password.value = ''
  categories.value = []
  products.value = []
  customizations.value = []
  employees.value = []
  settings.value = []
  orders.value = []
  navigateTo('/admin', { replace: true })
}

async function refreshCategories () {
  const res = await api.get<{ items: Category[] }>('/api/admin/categories')
  categories.value = Array.isArray(res.items) ? res.items : []
}
async function refreshProducts () {
  const res = await api.get<{ items: Product[] }>('/api/admin/products')
  products.value = Array.isArray(res.items) ? res.items : []
}
async function refreshCustomizations () {
  const res = await api.get<{ items: Customization[] }>('/api/admin/customization-options')
  customizations.value = Array.isArray(res.items) ? res.items : []
}
async function refreshEmployees () {
  const res = await api.get<{ items: Employee[] }>('/api/admin/employees')
  employees.value = Array.isArray(res.items) ? res.items : []
}
async function refreshSettings () {
  const res = await api.get<{ items: Setting[] }>('/api/admin/system-settings')
  settings.value = Array.isArray(res.items) ? res.items : []
}
async function refreshOrders () {
  const res = await api.get<{ items: Order[] }>('/api/admin/orders')
  orders.value = Array.isArray(res.items) ? res.items : []
}

async function loadAll () {
  loading.value = true
  loadError.value = null
  try {
    await refreshCategories()
    await refreshProducts()
    await refreshCustomizations()
    if (coreReady.value) {
      await Promise.all([refreshEmployees(), refreshSettings(), refreshOrders()])
    } else {
      employees.value = []
      settings.value = []
      orders.value = []
    }
  } catch (e: any) {
    loadError.value = String(e?.message || 'Failed to load admin data.')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (auth.adminPassword.value && !verified.value) {
    const ok = await verifyPassword(auth.adminPassword.value).catch(() => false)
    if (ok) verified.value = true
    else auth.clearRole('admin')
  }
  if (verified.value) await loadAll()
})
</script>

<template>
  <main class="min-h-screen bg-gray-50 px-4 py-8">
    <section class="mx-auto max-w-6xl space-y-6">
      <div v-if="!verified" class="mx-auto w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 class="text-2xl font-semibold text-gray-900">Admin Login</h1>
        <p class="mt-1 text-sm text-gray-600">
          Enter the admin password to access the admin dashboard.
        </p>
        <form class="mt-4 space-y-3" @submit.prevent="login">
          <div>
            <label class="text-sm font-medium text-gray-700">Admin password</label>
            <input v-model="password" type="password" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="loginBusy">
          </div>
          <p v-if="loginError" class="text-sm text-red-600">{{ loginError }}</p>
          <button type="submit" class="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60" :disabled="loginBusy">{{ loginBusy ? 'Verifying…' : 'Login' }}</button>
        </form>
      </div>

      <div v-else class="space-y-6">
        <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-2xl font-semibold text-gray-900">Admin Console</h1>
              <p class="text-sm text-gray-600">Clean CRUD tools for all admin entities, with enforced dependency order.</p>
            </div>
            <button class="rounded-md border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50" @click="logout">Logout</button>
          </div>
          <div class="mt-4 grid gap-3 sm:grid-cols-3">
            <div class="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm"><div class="font-medium text-gray-900">Categories</div><div>{{ categories.length }}</div></div>
            <div class="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm"><div class="font-medium text-gray-900">Products</div><div>{{ products.length }}</div></div>
            <div class="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm"><div class="font-medium text-gray-900">Customizations</div><div>{{ customizations.length }}</div></div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <NuxtLink to="/admin/categories" class="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">Categories</NuxtLink>
            <NuxtLink to="/admin/products" class="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">Products</NuxtLink>
            <NuxtLink to="/admin/customizations" class="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">Customizations</NuxtLink>
            <NuxtLink to="/admin/employees" class="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">Employees</NuxtLink>
            <NuxtLink to="/admin/settings" class="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">Settings</NuxtLink>
            <NuxtLink to="/admin/orders" class="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">Orders</NuxtLink>
          </div>
          <p v-if="loadError" class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ loadError }}</p>
          <p v-if="loading" class="mt-4 text-sm text-gray-600">Loading admin data…</p>
        </div>

        <CategoriesManager
          v-if="activeSection === 'categories'"
          :items="categories"
          :can-manage="canManage.categories"
          :error-message="null"
          @refresh="loadAll"
        />

        <ProductsManager
          v-else-if="activeSection === 'products'"
          :categories="categories"
          :items="products"
          :can-manage="canManage.products"
          :error-message="sectionMessage.products"
          @refresh="loadAll"
        />

        <CustomizationsManager
          v-else-if="activeSection === 'customizations'"
          :categories="categories"
          :products="products"
          :items="customizations"
          :can-manage="canManage.customizations"
          :error-message="sectionMessage.customizations"
          @refresh="loadAll"
        />

        <EmployeesManager
          v-else-if="activeSection === 'employees'"
          :items="employees"
          :can-manage="canManage.employees"
          :error-message="sectionMessage.employees"
          @refresh="loadAll"
        />

        <SystemSettingsManager
          v-else-if="activeSection === 'settings'"
          :items="settings"
          :can-manage="canManage.settings"
          :error-message="sectionMessage.settings"
          @refresh="loadAll"
        />

        <OrdersManager
          v-else
          :items="orders"
          :employees="employees"
          :can-manage="canManage.orders"
          :error-message="sectionMessage.orders"
          @refresh="loadAll"
        />
      </div>
    </section>
  </main>
</template>

