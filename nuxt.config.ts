// https://nuxt.com/docs/api/configuration/nuxt-config
//
// Security: do not commit real passwords. In production (NODE_ENV=production),
// NUXT_ADMIN_PASSWORD and NUXT_STATION_PASSWORD must be set (e.g. Cloudflare Worker secrets).
// Dev-only fallbacks apply only when not building/running for production.

const isProduction = process.env.NODE_ENV === 'production'

function resolveRolePassword (envValue: string | undefined, devFallback: string) {
  if (envValue && envValue.length > 0) {
    return envValue
  }
  if (!isProduction) {
    return devFallback
  }
  return ''
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  nitro: {
    preset: 'cloudflare-module',
    compatibilityDate: '2025-07-15',
    cloudflare: {
      nodeCompat: true,
      deployConfig: false
    }
  },
  modules: [
    '@nuxtjs/tailwindcss'
  ],
  runtimeConfig: {
    adminPassword: resolveRolePassword(process.env.NUXT_ADMIN_PASSWORD, 'dev-admin-password'),
    stationPassword: resolveRolePassword(process.env.NUXT_STATION_PASSWORD, 'dev-station-password')
  }
})
