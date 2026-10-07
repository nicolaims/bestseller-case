<script setup lang="ts">
import { computed } from 'vue'
import type { TicketStatus } from '../../types'

const props = defineProps<{ status: TicketStatus }>()

const COLOURS: Record<TicketStatus, string> = {
  Pending: 'bg-gray-100 text-gray-700',
  Sent: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Completed: 'bg-teal-100 text-teal-700',
  Approved: 'bg-green-100 text-green-700',
}

const classes = computed(() => COLOURS[props.status])
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" :class="classes">
    {{ status }}
  </span>
</template>
