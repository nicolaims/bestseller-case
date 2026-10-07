<script setup lang="ts">
import { computed } from 'vue'
import { usePartnersStore } from '../../stores/partners.store'
import { useLightboxStore } from '../../stores/lightbox.store'
import PriorityBadge from '../badges/PriorityBadge.vue'
import type { ApprovedPhoto, Ticket } from '../../types'

const props = defineProps<{ ticket: Ticket; photos: ApprovedPhoto[] }>()

const partnersStore = usePartnersStore()
const lightbox = useLightboxStore()
const partnerName = computed(
  () => partnersStore.partners.find((p) => p.id === props.ticket.partnerId)?.name ?? '—',
)

/** Variants are approved independently; this just reuses the first photo's approver/date as a
 * representative header for the card, since each photo already shows its own variant below. */
const approvedMeta = computed(() => props.photos[0])

function variantFor(photo: ApprovedPhoto) {
  return props.ticket.colourVariants.find((v) => v.id === photo.variantId)
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md">
    <div class="flex items-start justify-between gap-2 border-b border-gray-100 p-3">
      <div>
        <p class="font-medium text-gray-900">{{ ticket.photoId }}</p>
        <p class="text-sm text-gray-500">{{ partnerName }}</p>
      </div>
      <PriorityBadge :priority="ticket.priority" />
    </div>

    <div class="p-3">
      <p class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Style (original photo)</p>
      <img
        :src="ticket.basePhotos.front"
        alt="Original style photo"
        class="aspect-[3/4] w-24 cursor-zoom-in rounded object-cover transition-opacity hover:opacity-80"
        @click="lightbox.open(ticket.basePhotos.front, `${ticket.photoId} — style`)"
      />
    </div>

    <div class="border-t border-gray-100 p-3">
      <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        Approved colours ({{ photos.length }})
      </p>
      <div class="grid grid-cols-3 gap-2">
        <div v-for="photo in photos" :key="photo.id" class="min-w-0">
          <img
            :src="photo.imagePath"
            alt=""
            class="aspect-[3/4] w-full cursor-zoom-in rounded object-cover transition-opacity hover:opacity-80"
            @click="lightbox.open(photo.imagePath, variantFor(photo)?.name ?? '')"
          />
          <p class="mt-1 truncate text-xs font-medium text-gray-700" :title="variantFor(photo)?.name">
            {{ variantFor(photo)?.name ?? '—' }}
          </p>
          <p class="truncate text-[11px] text-gray-400">
            {{ variantFor(photo)?.type === 'aop' ? 'AOP pattern' : 'Solid colour' }}
          </p>
        </div>
      </div>
    </div>

    <p v-if="approvedMeta" class="border-t border-gray-100 px-3 py-2 text-xs text-gray-400">
      Approved by {{ approvedMeta.approvedBy }} · {{ new Date(approvedMeta.approvedAt).toLocaleDateString() }}
    </p>
  </div>
</template>
