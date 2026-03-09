// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  nitro: {
    preset: 'cloudflare-module',
    compatibilityDate: '2025-07-15',
    cloudflare: {
      nodeCompat: true,
      deployConfig: true
    }
  },
  modules: [
    '@nuxtjs/tailwindcss'
  ],
  runtimeConfig: {
    adminPassword: process.env.NUXT_ADMIN_PASSWORD || 'dev-admin-password',
    stationPassword: process.env.NUXT_STATION_PASSWORD || 'dev-station-password'
  }
})
