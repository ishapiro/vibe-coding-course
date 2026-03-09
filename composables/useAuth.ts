const ADMIN_STORAGE_KEY = 'auth:adminPassword'
const STATION_STORAGE_KEY = 'auth:stationPassword'

type Role = 'admin' | 'station'

function loadFromStorage (key: string): string | null {
  if (process.server) {
    return null
  }

  try {
    const value = window.sessionStorage.getItem(key)
    return value || null
  } catch {
    return null
  }
}

function saveToStorage (key: string, value: string | null) {
  if (process.server) {
    return
  }

  try {
    if (value) {
      window.sessionStorage.setItem(key, value)
    } else {
      window.sessionStorage.removeItem(key)
    }
  } catch {
    // Ignore storage errors (e.g. disabled storage)
  }
}

export function useAuth () {
  const adminPassword = useState<string | null>('auth-admin-password', () =>
    loadFromStorage(ADMIN_STORAGE_KEY)
  )

  const stationPassword = useState<string | null>('auth-station-password', () =>
    loadFromStorage(STATION_STORAGE_KEY)
  )

  function setAuthenticated (role: Role, password: string) {
    if (role === 'admin') {
      adminPassword.value = password
      saveToStorage(ADMIN_STORAGE_KEY, password)
    } else {
      stationPassword.value = password
      saveToStorage(STATION_STORAGE_KEY, password)
    }
  }

  function clearRole (role: Role) {
    if (role === 'admin') {
      adminPassword.value = null
      saveToStorage(ADMIN_STORAGE_KEY, null)
    } else {
      stationPassword.value = null
      saveToStorage(STATION_STORAGE_KEY, null)
    }
  }

  function isAuthenticated (role: Role): boolean {
    return role === 'admin'
      ? !!adminPassword.value
      : !!stationPassword.value
  }

  function getAuthHeadersForRole (role: Role): HeadersInit {
    if (role === 'admin') {
      return adminPassword.value
        ? { 'x-admin-password': adminPassword.value }
        : {}
    }

    return stationPassword.value
      ? { 'x-station-password': stationPassword.value }
      : {}
  }

  function getAllAuthHeaders (): HeadersInit {
    const headers: Record<string, string> = {}

    if (adminPassword.value) {
      headers['x-admin-password'] = adminPassword.value
    }

    if (stationPassword.value) {
      headers['x-station-password'] = stationPassword.value
    }

    return headers
  }

  return {
    adminPassword,
    stationPassword,
    setAuthenticated,
    clearRole,
    isAuthenticated,
    getAuthHeadersForRole,
    getAllAuthHeaders
  }
}

