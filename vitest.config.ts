import { defineConfig } from 'vitest/config'
import dotenv from 'dotenv'

// Load environment variables from .env so tests can see NUXT_* values
dotenv.config()

export default defineConfig({
  test: {
    environment: 'node'
  }
})

