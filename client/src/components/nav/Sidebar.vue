<script setup lang="ts">
import { computed } from 'vue'
import RoleSwitcher from './RoleSwitcher.vue'
import NewTicketButton from '../tickets/NewTicketButton.vue'

const open = defineModel<boolean>('open', { default: false })

const navItems = computed(() => [
  { to: '/', label: 'Dashboard' },
  { to: '/tickets', label: 'Ticket Queue' },
  { to: '/partners', label: 'Partner Overview' },
  { to: '/approved', label: 'Approved Library' },
])
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-30 bg-black/30 lg:hidden"
    @click="open = false"
  />

  <aside
    class="fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col justify-between border-r border-gray-200 bg-white p-4 transition-transform duration-200 lg:static lg:translate-x-0"
    :class="open ? 'translate-x-0' : '-translate-x-full'"
  >
    <div>
      <div class="mb-4 flex items-center justify-between px-2">
        <h1 class="text-lg font-semibold text-gray-900">Recolour Requests</h1>
        <button type="button" class="cursor-pointer text-gray-400 lg:hidden" @click="open = false">✕</button>
      </div>
      <NewTicketButton class="mb-4 w-full justify-center" @click="open = false" />
      <nav class="space-y-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          active-class="bg-gray-900 text-white hover:bg-gray-900"
          exact-active-class="bg-gray-900 text-white hover:bg-gray-900"
          @click="open = false"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </div>
    <RoleSwitcher />
  </aside>
</template>
