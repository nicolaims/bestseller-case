<script setup lang="ts">
import { usePartnersStore } from '../../stores/partners.store'
import { useLightboxStore } from '../../stores/lightbox.store'
import StatusBadge from '../badges/StatusBadge.vue'
import PriorityBadge from '../badges/PriorityBadge.vue'
import OwnerBadge from '../badges/OwnerBadge.vue'
import type { Ticket } from '../../types'

withDefaults(defineProps<{ tickets: Ticket[]; showPartner?: boolean }>(), { showPartner: true })
const emit = defineEmits<{ select: [id: string] }>()

const partnersStore = usePartnersStore()
const lightbox = useLightboxStore()

function partnerName(partnerId: string) {
  return partnersStore.partners.find((p) => p.id === partnerId)?.name ?? '—'
}
</script>

<template>
  <table class="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-gray-200 bg-white text-sm">
    <thead class="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
      <tr>
        <th class="px-4 py-2">Photo</th>
        <th class="px-4 py-2">Style / Product</th>
        <th class="px-4 py-2">Variants</th>
        <th class="px-4 py-2">Priority</th>
        <th v-if="showPartner" class="px-4 py-2">Partner</th>
        <th class="px-4 py-2">Status</th>
        <th class="px-4 py-2">Updated</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="ticket in tickets"
        :key="ticket.id"
        class="cursor-pointer border-t border-gray-100 transition-colors hover:bg-gray-50"
        @click="emit('select', ticket.id)"
      >
        <td class="px-4 py-2">
          <img
            :src="ticket.basePhotos.front"
            :alt="ticket.photoId"
            class="h-12 w-10 cursor-zoom-in rounded object-cover transition-opacity hover:opacity-80"
            @click.stop="lightbox.open(ticket.basePhotos.front, ticket.photoId)"
          />
        </td>
        <td class="px-4 py-2 font-medium text-gray-900">{{ ticket.photoId }}</td>
        <td class="px-4 py-2">
          <div class="flex flex-wrap gap-1">
            <span
              v-for="variant in ticket.colourVariants"
              :key="variant.id"
              class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
            >
              {{ variant.name }}
            </span>
          </div>
        </td>
        <td class="px-4 py-2"><PriorityBadge :priority="ticket.priority" /></td>
        <td v-if="showPartner" class="px-4 py-2 text-gray-600">{{ partnerName(ticket.partnerId) }}</td>
        <td class="px-4 py-2">
          <div class="flex flex-col gap-1">
            <StatusBadge :status="ticket.status" />
            <OwnerBadge :ticket="ticket" />
          </div>
        </td>
        <td class="px-4 py-2 text-gray-500">{{ new Date(ticket.updatedAt).toLocaleString() }}</td>
      </tr>
      <tr v-if="tickets.length === 0">
        <td :colspan="showPartner ? 7 : 6" class="px-4 py-8 text-center text-gray-400">No tickets match the current filters.</td>
      </tr>
    </tbody>
  </table>
</template>
