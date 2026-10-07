<script setup lang="ts">
import { onMounted } from 'vue'
import { usePartnersStore } from '../../stores/partners.store'
import { useTicketsStore } from '../../stores/tickets.store'
import type { SortBy } from '../../stores/tickets.store'
import { getTicketOwnership, type TicketOwner } from '../../utils/ticketOwnership'

const STATUSES = ['Pending', 'Sent', 'In Progress', 'Completed', 'Approved'] as const
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const
const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'recent', label: 'Most recent' },
  { value: 'priority', label: 'Priority' },
]
const OWNER_OPTIONS: Array<{ value: TicketOwner | undefined; label: string }> = [
  { value: undefined, label: 'All' },
  { value: 'Manager', label: 'With: Manager' },
  { value: 'Operator', label: 'With: Operator' },
  { value: 'Partner', label: 'With: Partner' },
  { value: null, label: 'Done' },
]

const ticketsStore = useTicketsStore()
const partnersStore = usePartnersStore()

onMounted(() => {
  if (!partnersStore.loaded) partnersStore.fetchPartners()
})

function countFor(owner: TicketOwner | undefined) {
  if (owner === undefined) return ticketsStore.tickets.length
  return ticketsStore.tickets.filter((t) => getTicketOwnership(t).owner === owner).length
}
</script>

<template>
  <div class="mb-3 flex flex-wrap items-center gap-2">
    <button
      v-for="option in OWNER_OPTIONS"
      :key="String(option.value)"
      type="button"
      class="cursor-pointer rounded-full border px-3 py-1 text-sm font-medium transition-colors"
      :class="
        ticketsStore.filters.owner === option.value
          ? 'border-gray-900 bg-gray-900 text-white'
          : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900'
      "
      @click="ticketsStore.filters.owner = option.value"
    >
      {{ option.label }} ({{ countFor(option.value) }})
    </button>
  </div>

  <div class="mb-4 flex flex-wrap items-center gap-3">
    <input
      v-model="ticketsStore.filters.search"
      type="text"
      placeholder="Search style or product number…"
      class="rounded-md border border-gray-300 px-3 py-1.5 text-sm transition-colors focus:border-gray-400"
    />
    <select
      v-model="ticketsStore.filters.status"
      class="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm transition-colors hover:border-gray-400"
    >
      <option :value="undefined">All statuses</option>
      <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
    </select>
    <select
      v-model="ticketsStore.filters.priority"
      class="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm transition-colors hover:border-gray-400"
    >
      <option :value="undefined">All priorities</option>
      <option v-for="p in PRIORITIES" :key="p" :value="p">{{ p }}</option>
    </select>
    <select
      v-model="ticketsStore.filters.partnerId"
      class="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm transition-colors hover:border-gray-400"
    >
      <option :value="undefined">All partners</option>
      <option v-for="partner in partnersStore.partners" :key="partner.id" :value="partner.id">
        {{ partner.name }}
      </option>
    </select>
    <button
      v-if="
        ticketsStore.filters.status ||
        ticketsStore.filters.priority ||
        ticketsStore.filters.partnerId ||
        ticketsStore.filters.search ||
        ticketsStore.filters.owner !== undefined
      "
      type="button"
      class="cursor-pointer text-sm text-gray-500 transition-colors hover:text-gray-900"
      @click="ticketsStore.filters = {}"
    >
      Clear filters
    </button>

    <div class="ml-auto flex items-center gap-2">
      <span class="text-xs font-medium uppercase tracking-wide text-gray-500">Sort by</span>
      <div class="flex gap-1 rounded-md bg-gray-200 p-1">
        <button
          v-for="option in SORT_OPTIONS"
          :key="option.value"
          type="button"
          class="cursor-pointer rounded px-2.5 py-1 text-sm font-medium transition-colors"
          :class="
            ticketsStore.sortBy === option.value
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          "
          @click="ticketsStore.sortBy = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
  </div>
</template>
