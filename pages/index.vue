<template>
  <main class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <section class="w-full max-w-2xl space-y-8">
      <header class="text-center space-y-2">
        <h1 class="text-4xl font-bold text-brand">
          Welcome to the app
        </h1>
        <p class="text-gray-600">
          Temporary home page with password test helpers.
        </p>
      </header>

      <div class="grid gap-8 md:grid-cols-2">
        <!-- Admin password tester -->
        <form
          class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4"
          @submit.prevent="checkPassword('admin')"
        >
          <h2 class="text-lg font-semibold text-gray-900">
            Admin login test
          </h2>
          <label class="block text-left space-y-1">
            <span class="text-sm font-medium text-gray-700">
              Admin password
            </span>
            <input
              v-model="adminPassword"
              type="password"
              autocomplete="off"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand"
            />
          </label>
          <button
            type="submit"
            class="inline-flex w-full items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-60"
            :disabled="adminLoading"
          >
            <span v-if="adminLoading">Checking…</span>
            <span v-else>Login</span>
          </button>
          <p v-if="adminMessage" class="text-sm" :class="adminMessageClass">
            {{ adminMessage }}
          </p>
        </form>

        <!-- Station password tester -->
        <form
          class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4"
          @submit.prevent="checkPassword('station')"
        >
          <h2 class="text-lg font-semibold text-gray-900">
            Station login test
          </h2>
          <label class="block text-left space-y-1">
            <span class="text-sm font-medium text-gray-700">
              Station password
            </span>
            <input
              v-model="stationPassword"
              type="password"
              autocomplete="off"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand"
            />
          </label>
          <button
            type="submit"
            class="inline-flex w-full items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-60"
            :disabled="stationLoading"
          >
            <span v-if="stationLoading">Checking…</span>
            <span v-else>Login</span>
          </button>
          <p v-if="stationMessage" class="text-sm" :class="stationMessageClass">
            {{ stationMessage }}
          </p>
        </form>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
const adminPassword = ref("")
const adminLoading = ref(false)
const adminMessage = ref("")
const adminSuccess = ref<boolean | null>(null)

const stationPassword = ref("")
const stationLoading = ref(false)
const stationMessage = ref("")
const stationSuccess = ref<boolean | null>(null)

const adminMessageClass = computed(() =>
  adminSuccess.value === null
    ? "text-gray-600"
    : adminSuccess.value
      ? "text-green-600"
      : "text-red-600"
)

const stationMessageClass = computed(() =>
  stationSuccess.value === null
    ? "text-gray-600"
    : stationSuccess.value
      ? "text-green-600"
      : "text-red-600"
)

async function checkPassword (role: 'admin' | 'station') {
  const passwordRef = role === 'admin' ? adminPassword : stationPassword
  const loadingRef = role === 'admin' ? adminLoading : stationLoading
  const messageRef = role === 'admin' ? adminMessage : stationMessage
  const successRef = role === 'admin' ? adminSuccess : stationSuccess

  if (!passwordRef.value) {
    messageRef.value = 'Please enter a password.'
    successRef.value = null
    return
  }

  loadingRef.value = true
  messageRef.value = ''
  successRef.value = null

  try {
    const response = await fetch('/api/check-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role,
        password: passwordRef.value
      })
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      messageRef.value =
        typeof data.error === 'string'
          ? data.error
          : 'Password check failed.'
      successRef.value = false
      return
    }

    if (data && typeof data.ok === 'boolean') {
      successRef.value = data.ok
      messageRef.value = data.ok
        ? 'Password is correct.'
        : 'Password is incorrect.'
    } else {
      messageRef.value = 'Unexpected response from server.'
      successRef.value = false
    }
  } catch {
    messageRef.value = 'Network error while checking password.'
    successRef.value = false
  } finally {
    loadingRef.value = false
  }
}
</script>

