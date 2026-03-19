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
      <div class="flex-1">
        <h1 class="text-4xl font-bold leading-tight text-gray-900 md:text-5xl">
          What would you like to order?
        </h1>
        <p class="mt-3 max-w-2xl text-base text-gray-700">
          Build your order quickly with clear choices and simple steps.
        </p>
      </div>

      <div class="border-t border-gray-200 pt-6">
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

const staffModalOpen = ref(false)
const staffPassword = ref('')
const authenticating = ref(false)
const staffUnlocked = ref(false)
const staffAuthMessage = ref('')
const staffAuthOk = ref(false)

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
})
</script>

