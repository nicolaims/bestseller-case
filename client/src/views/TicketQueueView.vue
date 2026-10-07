<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useTicketsStore } from '../stores/tickets.store'
import { usePartnersStore } from '../stores/partners.store'
import TicketFilters from '../components/tickets/TicketFilters.vue'
import TicketTable from '../components/tickets/TicketTable.vue'
import TicketDetailDrawer from '../components/tickets/TicketDetailDrawer.vue'

const ticketsStore = useTicketsStore()
const partnersStore = usePartnersStore()
const selectedTicketId = ref<string | null>(null)

onMounted(() => {
  if (!ticketsStore.loaded) ticketsStore.fetchTickets()
  if (!partnersStore.loaded) partnersStore.fetchPartners()
})
</script>

<template>
  <div>
    <h1 class="mb-6 text-xl font-semibold text-gray-900">Ticket Queue</h1>
    <p v-if="ticketsStore.loadError" class="mb-4 flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ ticketsStore.loadError }}
      <button type="button" class="cursor-pointer font-medium underline" @click="ticketsStore.fetchTickets()">Retry</button>
    </p>
    <TicketFilters />
    <TicketTable :tickets="ticketsStore.filteredTickets" @select="selectedTicketId = $event" />
    <TicketDetailDrawer :ticket-id="selectedTicketId" @close="selectedTicketId = null" />
  </div>
</template>
