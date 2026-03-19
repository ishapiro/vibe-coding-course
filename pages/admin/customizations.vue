<script setup lang="ts">
import AdminPage from '~/components/admin/AdminPage.vue'

definePageMeta({
  middleware: ['admin-auth']
})
</script>

<template>
  <AdminPage section="customizations" />
</template>

