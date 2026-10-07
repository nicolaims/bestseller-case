<script setup lang="ts">
defineProps<{ label: string; value: number }>()
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md">
    <p class="text-xs font-medium uppercase tracking-wide text-gray-500">{{ label }}</p>
    <p class="mt-1 text-2xl font-semibold text-gray-900">{{ value }}</p>
  </div>
</template>
