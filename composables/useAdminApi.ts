type AdminBody = unknown

function parseJsonSafely (text: string): any {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

function toErrorMessage (response: Response, payload: any): string {
  if (payload && typeof payload.error === 'string' && payload.error) return payload.error
  if (payload && typeof payload.message === 'string' && payload.message) return payload.message
  return `${response.status} ${response.statusText}`.trim()
}

export function useAdminApi () {
  const auth = useAuth()

  async function request<T = any> (url: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    const authHeaders = auth.getAuthHeadersForRole('admin')

    Object.entries(authHeaders).forEach(([key, value]) => {
      if (typeof value === 'string') headers.set(key, value)
    })

    let body = init.body
    if (body !== undefined && body !== null && typeof body !== 'string' && !(body instanceof FormData)) {
      if (!headers.get('Content-Type')) headers.set('Content-Type', 'application/json')
      body = JSON.stringify(body)
    }

    const response = await fetch(url, { ...init, headers, body })
    const text = await response.text().catch(() => '')
    const payload = parseJsonSafely(text)

    if (!response.ok) {
      throw new Error(toErrorMessage(response, payload))
    }

    return payload as T
  }

  return {
    get: <T = any>(url: string) => request<T>(url, { method: 'GET' }),
    post: <T = any>(url: string, body?: AdminBody) => request<T>(url, { method: 'POST', body }),
    put: <T = any>(url: string, body?: AdminBody) => request<T>(url, { method: 'PUT', body }),
    del: <T = any>(url: string) => request<T>(url, { method: 'DELETE' })
  }
}

