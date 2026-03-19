export default defineNuxtRouteMiddleware(async (to) => {
  if (process.server) return

  const auth = useAuth()
  const verified = useState<boolean>('admin-verified', () => false)

  if (!auth.adminPassword.value) {
    return navigateTo(`/admin?next=${encodeURIComponent(to.fullPath)}`, { replace: true })
  }

  if (verified.value) return

  try {
    const response = await fetch('/api/check-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'admin',
        password: auth.adminPassword.value
      })
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload?.ok) {
      auth.clearRole('admin')
      verified.value = false
      return navigateTo(`/admin?next=${encodeURIComponent(to.fullPath)}`, { replace: true })
    }

    verified.value = true
  } catch {
    auth.clearRole('admin')
    verified.value = false
    return navigateTo(`/admin?next=${encodeURIComponent(to.fullPath)}`, { replace: true })
  }
})

