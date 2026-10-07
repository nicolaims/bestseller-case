<script setup lang="ts">
import { computed } from 'vue'
import { getTicketOwnership, type TicketOwner } from '../../utils/ticketOwnership'
import type { PartnerReceipt, TicketStatus } from '../../types'

const props = defineProps<{
  ticket: { status: TicketStatus; partnerReceipt?: PartnerReceipt; lastRejectionReason?: string }
}>()

const COLOURS: Record<Exclude<TicketOwner, null>, string> = {
  Operator: 'bg-indigo-100 text-indigo-700',
  Manager: 'bg-violet-100 text-violet-700',
  Partner: 'bg-cyan-100 text-cyan-700',
}

const ownership = computed(() => getTicketOwnership(props.ticket))
const classes = computed(() => (ownership.value.owner ? COLOURS[ownership.value.owner] : 'bg-green-50 text-green-700'))
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
    :class="classes"
    :title="ownership.nextStepLabel"
  >
    {{ ownership.owner ? `With: ${ownership.owner}` : 'Done' }}
  </span>
</template>
