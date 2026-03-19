<script setup lang="ts">
type Setting = { key: string, value: string }

const props = defineProps<{
  items: Setting[]
  canManage: boolean
  errorMessage?: string | null
}>()

const emit = defineEmits<{ refresh: [] }>()
const api = useAdminApi()

const keyName = ref('')
const keyValue = ref('')
const saving = ref(false)
const error = ref<string | null>(null)

const edits = reactive<Record<string, string>>({})

watch(() => props.items, (next) => {
  next.forEach((s) => { if (edits[s.key] === undefined) edits[s.key] = s.value })
}, { immediate: true })

async function saveNew () {
  if (!props.canManage) return
  saving.value = true
  error.value = null
  try {
    const key = keyName.value.trim()
    if (!key) throw new Error('Setting key is required.')
    await api.post('/api/admin/system-settings', { key, value: keyValue.value })
    keyName.value = ''
    keyValue.value = ''
    emit('refresh')
  } catch (e: any) {
    error.value = String(e?.message || 'Failed to save setting.')
  } finally {
    saving.value = false
  }
}

async function saveExisting (key: string) {
  if (!props.canManage) return
  saving.value = true
  error.value = null
  try {
    await api.post('/api/admin/system-settings', { key, value: edits[key] ?? '' })
    emit('refresh')
  } catch (e: any) {
    error.value = String(e?.message || 'Failed to update setting.')
  } finally {
    saving.value = false
  }
}

const thankYouRows = 4
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-lg font-semibold text-gray-900">Settings</h2>
    <p v-if="errorMessage" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{{ errorMessage }}</p>
    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <h3 class="text-sm font-semibold text-gray-900">Existing Settings</h3>
        <table class="mt-3 w-full text-sm">
          <thead class="text-left text-gray-500"><tr><th>Key</th><th>Value</th><th /></tr></thead>
          <tbody>
            <tr v-for="item in items" :key="item.key" class="border-t border-gray-100">
              <td class="py-2">{{ item.key }}</td>
              <td>
                <textarea
                  v-if="item.key === 'thank_you_message'"
                  v-model="edits[item.key]"
                  :rows="thankYouRows"
                  class="w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand"
                  :disabled="saving || !canManage"
                ></textarea>
                <input
                  v-else
                  v-model="edits[item.key]"
                  type="text"
                  class="w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand"
                  :disabled="saving || !canManage"
                >
              </td>
              <td class="text-right"><button class="rounded-md border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50" :disabled="saving || !canManage" @click="saveExisting(item.key)">Save</button></td>
            </tr>
            <tr v-if="items.length===0"><td colspan="3" class="py-3 text-gray-500">No settings yet.</td></tr>
          </tbody>
        </table>
      </div>

      <form class="rounded-lg border border-gray-200 bg-white p-4 space-y-3" @submit.prevent="saveNew">
        <h3 class="text-sm font-semibold text-gray-900">Create / Update Setting</h3>
        <div><label class="text-sm font-medium text-gray-700">Key</label><input v-model="keyName" type="text" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage"></div>
        <div><label class="text-sm font-medium text-gray-700">Value</label><textarea v-model="keyValue" rows="4" class="mt-1 w-full rounded-md border border-gray-300 focus:border-brand focus:ring-brand" :disabled="saving || !canManage"></textarea></div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <button type="submit" class="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60" :disabled="saving || !canManage">{{ saving ? 'Saving…' : 'Save Setting' }}</button>
      </form>
    </div>
  </section>
</template>

