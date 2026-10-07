<script setup lang="ts">
import { computed } from 'vue'
import { usePartnersStore } from '../../stores/partners.store'
import { useTicketsStore } from '../../stores/tickets.store'
import { useEscapeKey } from '../../composables/useEscapeKey'
import TicketTable from '../tickets/TicketTable.vue'
import type { TicketStatus } from '../../types'

const props = defineProps<{ partnerId: string | null }>()
const emit = defineEmits<{ close: []; selectTicket: [id: string] }>()

const partnersStore = usePartnersStore()
const ticketsStore = useTicketsStore()

const partner = computed(() => partnersStore.partners.find((p) => p.id === props.partnerId) ?? null)

useEscapeKey(() => {
  if (partner.value) emit('close')
})
const tickets = computed(() => ticketsStore.tickets.filter((t) => t.partnerId === props.partnerId))

const STATUSES: TicketStatus[] = ['Pending', 'Sent', 'In Progress', 'Completed', 'Approved', 'Rejected']
const counts = computed(() => {
  const result = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<TicketStatus, number>
  for (const t of tickets.value) result[t.status]++
  return result
})
</script>

<template>
  <div v-if="partner" class="fixed inset-0 z-20 flex justify-end bg-black/30" @click.self="emit('close')">
    <div class="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl">
      <div class="mb-4 flex items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">{{ partner.name }}</h2>
          <p class="text-sm text-gray-500">{{ tickets.length }} ticket(s)</p>
        </div>
        <button
          type="button"
          class="cursor-pointer text-gray-400 transition-colors hover:text-gray-700"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <div class="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <div v-for="status in STATUSES" :key="status" class="rounded-md border border-gray-200 p-2 text-center">
          <p class="text-lg font-semibold text-gray-900">{{ counts[status] }}</p>
          <p class="text-xs text-gray-500">{{ status }}</p>
        </div>
      </div>

      <h3 class="mb-2 text-sm font-medium text-gray-700">Tickets</h3>
      <TicketTable :tickets="tickets" :show-partner="false" @select="emit('selectTicket', $event)" />
    </div>
  </div>
</template>
