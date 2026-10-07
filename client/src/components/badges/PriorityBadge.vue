<script setup lang="ts">
import { computed } from 'vue'
import type { Priority } from '../../types'

const props = defineProps<{ priority: Priority }>()

const COLOURS: Record<Priority, string> = {
  Low: 'bg-gray-100 text-gray-600',
  Medium: 'bg-sky-100 text-sky-700',
  High: 'bg-orange-100 text-orange-700',
  Urgent: 'bg-red-100 text-red-700',
}

const classes = computed(() => COLOURS[props.priority])
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" :class="classes">
    {{ priority }}
  </span>
</template>
