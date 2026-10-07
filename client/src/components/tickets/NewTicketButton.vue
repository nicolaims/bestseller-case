<script setup lang="ts">
import { useRoleStore } from '../../stores/role.store'

const roleStore = useRoleStore()
</script>

<template>
  <RouterLink
    v-if="roleStore.isOperator"
    to="/tickets/new"
    class="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700"
  >
    <span class="text-base leading-none">+</span> New Ticket
  </RouterLink>
</template>
