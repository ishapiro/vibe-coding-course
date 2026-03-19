<template>
  <main class="min-h-screen bg-white text-gray-900">
    <header class="border-b border-gray-200 bg-white">
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">
            LOGO
          </div>
          <div>
            <p class="text-base font-semibold text-gray-900">
              Restaurant Name
            </p>
            <p class="text-xs text-gray-600">
              Fast ordering, clear status
            </p>
          </div>
        </div>
      </div>
    </header>

    <section class="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-6xl flex-col px-4 py-8">
      <div class="grid flex-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div class="space-y-6">
          <div>
            <h1 class="text-4xl font-bold leading-tight text-gray-900 md:text-5xl">
              What would you like to order?
            </h1>
            <p class="mt-3 max-w-2xl text-base text-gray-700">
              Build your order quickly with clear choices and simple steps.
            </p>
          </div>

          <section v-if="!orderPlaced" class="rounded-lg border border-gray-200 bg-white p-4">
            <h2 class="text-lg font-semibold text-gray-900">
              1) Your details
            </h2>
            <p class="mt-1 text-sm text-gray-600">
              Enter your name and email to begin building your order.
            </p>

            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label class="text-sm font-medium text-gray-700">Name</label>
                <input
                  v-model="customerName"
                  type="text"
                  autocomplete="name"
                  class="mt-1 block w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand"
                />
                <p v-if="customerNameTouched && !isNameValid" class="mt-1 text-xs text-red-600">
                  Please enter your name.
                </p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-700">Email Address</label>
                <input
                  v-model="customerEmail"
                  type="email"
                  autocomplete="email"
                  class="mt-1 block w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand"
                />
                <p v-if="customerEmailTouched && !isEmailValid" class="mt-1 text-xs text-red-600">
                  Please enter a valid email address.
                </p>
              </div>
            </div>

            <p v-if="!canStartOrdering" class="mt-3 text-sm text-amber-700">
              Complete both fields above to unlock the menu.
            </p>
            <p v-else class="mt-3 text-sm text-green-700">
              Details captured. You can now build your order.
            </p>
          </section>

          <section v-if="!orderPlaced" class="rounded-lg border border-gray-200 bg-white p-4">
            <h2 class="text-lg font-semibold text-gray-900">
              2) Build your order
            </h2>
            <p class="mt-1 text-sm text-gray-600">
              Select a category, then a product, then choose one or more customizations.
            </p>

            <p v-if="menuError" class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {{ menuError }}
            </p>
            <p v-else-if="menuLoading" class="mt-3 text-sm text-gray-600">
              Loading menu…
            </p>

            <template v-if="!menuLoading && !menuError">
              <div class="mt-4">
                <label class="text-sm font-medium text-gray-700">Category</label>
                <select
                  v-model.number="selectedCategoryId"
                  class="mt-1 block w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand"
                  :disabled="!canStartOrdering || categories.length === 0"
                >
                  <option v-for="category in categories" :key="category.id" :value="category.id">
                    {{ category.name }}
                  </option>
                </select>
              </div>

              <div class="mt-4">
                <label class="text-sm font-medium text-gray-700">Product</label>
                <div class="mt-2 grid gap-2">
                  <button
                    v-for="product in visibleProducts"
                    :key="product.id"
                    type="button"
                    class="w-full rounded-md border px-3 py-2 text-left text-sm"
                    :class="selectedProductId === product.id
                      ? 'border-brand bg-blue-50 text-gray-900'
                      : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'"
                    :disabled="!canStartOrdering"
                    @click="selectProduct(product.id)"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <span class="font-medium">{{ product.name }}</span>
                      <span class="font-semibold text-brand">{{ formatPrice(product.price) }}</span>
                    </div>
                    <p v-if="product.description" class="mt-1 text-xs text-gray-600">
                      {{ product.description }}
                    </p>
                  </button>
                  <p v-if="visibleProducts.length === 0" class="text-sm text-gray-500">
                    No products in this category yet.
                  </p>
                </div>
              </div>

              <div v-if="selectedProduct" class="mt-5 rounded-md border border-gray-200 bg-gray-50 p-4">
                <h3 class="text-sm font-semibold text-gray-900">
                  Customizations for {{ selectedProduct.name }}
                </h3>
                <p class="mt-1 text-xs text-gray-600">
                  Select any applicable options (multiple selections allowed).
                </p>

                <div v-if="applicableCustomizations.length === 0" class="mt-3 text-sm text-gray-600">
                  No customizations configured for this item.
                </div>

                <div v-else class="mt-3 space-y-4">
                  <div
                    v-for="customization in applicableCustomizations"
                    :key="customization.id"
                    class="rounded-md border border-gray-200 bg-white p-3"
                  >
                    <p class="text-sm font-medium text-gray-900">{{ customization.label }}</p>
                    <p class="mt-0.5 text-xs text-gray-600">Type: {{ customization.kind }}</p>

                    <div class="mt-2 space-y-2">
                      <label
                        v-for="option in getCustomizationOptions(customization)"
                        :key="`${customization.id}:${option}`"
                        class="flex items-center gap-2 text-sm text-gray-800"
                      >
                        <input
                          type="checkbox"
                          :checked="isCustomizationSelected(customization.id, option)"
                          :disabled="!canStartOrdering"
                          @change="toggleCustomization(customization.id, option)"
                        />
                        <span>{{ option }}</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div class="mt-4">
                  <button
                    type="button"
                    class="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-60"
                    :disabled="!canStartOrdering || !selectedProduct"
                    @click="addToCart"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </template>
          </section>

          <section v-if="orderPlaced" class="rounded-lg border border-green-200 bg-green-50 p-5">
            <h2 class="text-2xl font-semibold text-green-900">
              Thank you!
            </h2>
            <p class="mt-2 text-green-900">
              {{ thankYouText }}
            </p>
            <p v-if="placedOrderNumber" class="mt-2 text-sm font-medium text-green-800">
              Order number: {{ placedOrderNumber }}
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <a
                v-if="thankYouLink"
                :href="thankYouLink"
                class="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ thankYouLinkText }}
              </a>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                @click="startNewOrder"
              >
                Start New Order
              </button>
            </div>
          </section>
        </div>

        <aside class="rounded-lg border border-gray-200 bg-white p-4 lg:sticky lg:top-8 lg:h-fit">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">Cart</h2>
            <span class="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
              {{ cartItemCount }} items
            </span>
          </div>
          <p class="mt-1 text-sm text-gray-600">
            Running total: <span class="font-semibold text-gray-900">{{ formatPrice(cartTotal) }}</span>
          </p>

          <div class="mt-4 space-y-3">
            <div
              v-for="item in cart"
              :key="item.id"
              class="rounded-md border border-gray-200 bg-gray-50 p-3"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ item.productName }}</p>
                  <p class="text-xs text-gray-600">{{ item.categoryName }}</p>
                </div>
                <button
                  type="button"
                  class="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50"
                  @click="removeFromCart(item.id)"
                >
                  Remove
                </button>
              </div>
              <p class="mt-1 text-sm font-semibold text-brand">{{ formatPrice(item.price) }}</p>
              <ul v-if="item.customizations.length > 0" class="mt-2 space-y-1 text-xs text-gray-700">
                <li v-for="selection in item.customizations" :key="`${item.id}:${selection.customizationId}:${selection.option}`">
                  {{ selection.label }}: {{ selection.option }}
                </li>
              </ul>
            </div>

            <p v-if="cart.length === 0" class="text-sm text-gray-500">
              Your cart is empty.
            </p>
          </div>

          <div class="mt-4 flex gap-2">
            <button
              type="button"
              class="inline-flex flex-1 items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-60"
              :disabled="cart.length === 0"
              @click="clearCart"
            >
              Clear Cart
            </button>
            <button
              type="button"
              class="inline-flex flex-1 items-center justify-center rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
              :disabled="cart.length === 0 || placingOrder || orderPlaced"
              @click="placeOrder"
            >
              <span v-if="placingOrder">Placing…</span>
              <span v-else>Place Order</span>
            </button>
          </div>
          <p v-if="placeOrderMessage" class="mt-2 text-xs text-gray-600">
            {{ placeOrderMessage }}
          </p>
        </aside>
      </div>

      <div class="mt-8 border-t border-gray-200 pt-6">
        <div
          v-if="staffUnlocked"
          class="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4"
        >
          <p class="text-sm font-medium text-blue-900">
            Staff tools unlocked
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <NuxtLink
              to="/admin"
              class="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
            >
              Admin
            </NuxtLink>
            <NuxtLink
              to="/station"
              class="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
            >
              Order Processing Station
            </NuxtLink>
            <NuxtLink
              to="/status-board"
              class="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
            >
              Status Board
            </NuxtLink>
          </div>
        </div>

        <button
          type="button"
          class="inline-flex w-full items-center justify-center rounded-md bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 md:w-auto"
          @click="staffModalOpen = true"
        >
          Staff Access
        </button>
      </div>
    </section>

    <div
      v-if="staffModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-access-title"
    >
      <div class="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-lg">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 id="staff-access-title" class="text-lg font-semibold text-gray-900">
              Staff Access
            </h2>
            <p class="mt-1 text-sm text-gray-600">
              Enter staff password to unlock staff navigation links.
            </p>
          </div>
          <button
            type="button"
            class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-900 hover:bg-gray-50"
            :disabled="authenticating"
            @click="closeStaffModal()"
          >
            Close
          </button>
        </div>

        <form class="mt-4 space-y-3" @submit.prevent="authenticateStaff">
          <div>
            <label class="text-sm font-medium text-gray-700">
              Staff password
            </label>
            <input
              v-model="staffPassword"
              type="password"
              autocomplete="off"
              class="mt-1 block w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand"
              :disabled="authenticating"
            />
          </div>

          <p v-if="staffAuthMessage" class="text-sm" :class="staffAuthOk ? 'text-green-700' : 'text-red-600'">
            {{ staffAuthMessage }}
          </p>

          <button
            type="submit"
            class="inline-flex w-full items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-60"
            :disabled="authenticating"
          >
            <span v-if="authenticating">Verifying…</span>
            <span v-else>Unlock Staff Navigation</span>
          </button>
        </form>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
const { stationPassword: storedStationPassword, setAuthenticated } = useAuth()

type Category = {
  id: number
  name: string
  ordering: number
  kind: string | null
}

type Product = {
  id: number
  categoryId: number
  name: string
  description: string | null
  price: number
  ordering: number
}

type MenuCustomization = {
  id: number
  categoryId: number | null
  productId: number | null
  label: string
  kind: string
  options: string | null
  ordering: number
}

type CartSelection = {
  customizationId: number
  label: string
  option: string
}

type CartItem = {
  id: string
  productId: number
  productName: string
  categoryName: string
  price: number
  customizations: CartSelection[]
}

type PublicSettingsResponse = {
  items: Array<{ key: string, value: string }>
  byKey: Record<string, string>
}

const staffModalOpen = ref(false)
const staffPassword = ref('')
const authenticating = ref(false)
const staffUnlocked = ref(false)
const staffAuthMessage = ref('')
const staffAuthOk = ref(false)

const customerName = ref('')
const customerEmail = ref('')
const customerNameTouched = ref(false)
const customerEmailTouched = ref(false)

const categories = ref<Category[]>([])
const products = ref<Product[]>([])
const customizations = ref<MenuCustomization[]>([])
const menuLoading = ref(false)
const menuError = ref('')
const selectedCategoryId = ref<number | null>(null)
const selectedProductId = ref<number | null>(null)

const selectedCustomizationMap = ref<Record<number, string[]>>({})
const cart = ref<CartItem[]>([])
const placeOrderMessage = ref('')
const placingOrder = ref(false)
const orderPlaced = ref(false)
const placedOrderNumber = ref('')
const thankYouText = ref('Your order will be ready shortly')
const thankYouLink = ref('')
const thankYouLinkText = ref('View details')

const isNameValid = computed(() => customerName.value.trim().length > 0)
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isEmailValid = computed(() => emailRegex.test(customerEmail.value.trim()))
const canStartOrdering = computed(() => isNameValid.value && isEmailValid.value)

const visibleProducts = computed(() =>
  products.value.filter(product => product.categoryId === selectedCategoryId.value)
)

const selectedProduct = computed(() =>
  products.value.find(product => product.id === selectedProductId.value) || null
)

const selectedCategory = computed(() =>
  categories.value.find(category => category.id === selectedCategoryId.value) || null
)

const applicableCustomizations = computed(() => {
  if (!selectedProduct.value) return []
  const productId = selectedProduct.value.id
  const categoryId = selectedProduct.value.categoryId
  return customizations.value
    .filter(item => item.productId === productId || (item.productId === null && item.categoryId === categoryId))
    .sort((a, b) => a.ordering - b.ordering || a.id - b.id)
})

const cartItemCount = computed(() => cart.value.length)
const cartTotal = computed(() =>
  cart.value.reduce((sum, item) => sum + item.price, 0)
)

function formatPrice (value: number) {
  return `$${value.toFixed(2)}`
}

function parseOptionsList (value: string | null): string[] {
  if (!value) return ['Selected']
  const lines = value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  if (lines.length > 0) return lines
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.map(v => String(v).trim()).filter(Boolean)
    }
  } catch {
    // no-op
  }
  return [value]
}

function getCustomizationOptions (customization: MenuCustomization): string[] {
  return parseOptionsList(customization.options)
}

function isCustomizationSelected (customizationId: number, option: string) {
  const selected = selectedCustomizationMap.value[customizationId] || []
  return selected.includes(option)
}

function toggleCustomization (customizationId: number, option: string) {
  const current = selectedCustomizationMap.value[customizationId] || []
  const next = current.includes(option)
    ? current.filter(item => item !== option)
    : [...current, option]
  selectedCustomizationMap.value = {
    ...selectedCustomizationMap.value,
    [customizationId]: next
  }
}

function selectProduct (productId: number) {
  selectedProductId.value = productId
  selectedCustomizationMap.value = {}
}

function addToCart () {
  customerNameTouched.value = true
  customerEmailTouched.value = true
  placeOrderMessage.value = ''
  if (!canStartOrdering.value || !selectedProduct.value || !selectedCategory.value) return

  const selections: CartSelection[] = applicableCustomizations.value.flatMap(customization => {
    const selectedOptions = selectedCustomizationMap.value[customization.id] || []
    return selectedOptions.map(option => ({
      customizationId: customization.id,
      label: customization.label,
      option
    }))
  })

  const cartItem: CartItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    productId: selectedProduct.value.id,
    productName: selectedProduct.value.name,
    categoryName: selectedCategory.value.name,
    price: selectedProduct.value.price,
    customizations: selections
  }

  cart.value = [...cart.value, cartItem]
  selectedCustomizationMap.value = {}
}

function removeFromCart (itemId: string) {
  cart.value = cart.value.filter(item => item.id !== itemId)
}

function clearCart () {
  cart.value = []
}

async function loadPublicSettings () {
  try {
    const response = await fetch('/api/public-settings', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) return
    const data = await response.json().catch(() => ({} as PublicSettingsResponse))
    const byKey = data?.byKey || {}
    if (typeof byKey.thank_you_message === 'string' && byKey.thank_you_message.trim()) {
      thankYouText.value = byKey.thank_you_message
    }
    if (typeof byKey.thank_you_link === 'string' && byKey.thank_you_link.trim()) {
      thankYouLink.value = byKey.thank_you_link.trim()
    }
    if (typeof byKey.thank_you_link_text === 'string' && byKey.thank_you_link_text.trim()) {
      thankYouLinkText.value = byKey.thank_you_link_text.trim()
    }
  } catch {
    // keep defaults
  }
}

async function placeOrder () {
  customerNameTouched.value = true
  customerEmailTouched.value = true
  placeOrderMessage.value = ''

  if (!canStartOrdering.value) {
    placeOrderMessage.value = 'Please enter a valid name and email before placing your order.'
    return
  }

  if (cart.value.length === 0) {
    placeOrderMessage.value = 'Your cart is empty.'
    return
  }

  placingOrder.value = true
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: customerName.value.trim(),
        customerEmail: customerEmail.value.trim(),
        items: cart.value.map(item => ({
          productId: item.productId,
          quantity: 1,
          customizations: item.customizations
        }))
      })
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.ok) {
      placeOrderMessage.value =
        typeof data?.error === 'string' && data.error
          ? data.error
          : 'Unable to place order right now.'
      return
    }

    placedOrderNumber.value =
      typeof data?.item?.displayOrderNumber === 'string'
        ? data.item.displayOrderNumber
        : ''

    orderPlaced.value = true
    cart.value = []
    selectedCustomizationMap.value = {}
    selectedProductId.value = null
  } catch {
    placeOrderMessage.value = 'Network error while placing order.'
  } finally {
    placingOrder.value = false
  }
}

function startNewOrder () {
  orderPlaced.value = false
  placedOrderNumber.value = ''
  cart.value = []
  selectedCustomizationMap.value = {}
  selectedProductId.value = null
  selectedCategoryId.value = categories.value[0]?.id ?? null
  placeOrderMessage.value = ''
}

async function loadMenuData () {
  menuLoading.value = true
  menuError.value = ''
  try {
    const response = await fetch('/api/menu', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load menu.')

    categories.value = Array.isArray(data.categories) ? data.categories : []
    products.value = Array.isArray(data.products) ? data.products : []
    customizations.value = Array.isArray(data.customizations) ? data.customizations : []

    selectedCategoryId.value = categories.value[0]?.id ?? null
    selectedProductId.value = null
  } catch (error: any) {
    menuError.value = String(error?.message || 'Failed to load menu data.')
  } finally {
    menuLoading.value = false
  }
}

function closeStaffModal () {
  staffModalOpen.value = false
  staffPassword.value = ''
}

async function authenticateStaff () {
  if (!staffPassword.value.trim()) {
    staffAuthMessage.value = 'Please enter the staff password.'
    staffAuthOk.value = false
    return
  }

  authenticating.value = true
  staffAuthMessage.value = ''
  staffAuthOk.value = false

  try {
    const response = await fetch('/api/check-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'station',
        password: staffPassword.value
      })
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.ok) {
      staffAuthMessage.value = 'Incorrect staff password.'
      staffAuthOk.value = false
      return
    }

    setAuthenticated('station', staffPassword.value)
    staffUnlocked.value = true
    staffAuthMessage.value = 'Staff access granted.'
    staffAuthOk.value = true
    closeStaffModal()
  } catch {
    staffAuthMessage.value = 'Network error while checking password.'
    staffAuthOk.value = false
  } finally {
    authenticating.value = false
  }
}

onMounted(() => {
  staffUnlocked.value = !!storedStationPassword.value
  loadMenuData()
  loadPublicSettings()
})

watch(customerName, () => {
  customerNameTouched.value = true
})

watch(customerEmail, () => {
  customerEmailTouched.value = true
})

watch(selectedCategoryId, (nextCategoryId) => {
  if (!nextCategoryId) {
    selectedProductId.value = null
    return
  }
  const firstProduct = products.value.find(product => product.categoryId === nextCategoryId)
  selectedProductId.value = firstProduct?.id ?? null
  selectedCustomizationMap.value = {}
})
</script>

