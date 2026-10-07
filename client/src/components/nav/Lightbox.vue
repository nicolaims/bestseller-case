<script setup lang="ts">
import { useLightboxStore } from '../../stores/lightbox.store'
import { useEscapeKey } from '../../composables/useEscapeKey'

const lightbox = useLightboxStore()

useEscapeKey(() => lightbox.close())
</script>

<template>
  <div
    v-if="lightbox.url"
    class="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-8"
    @click="lightbox.close()"
  >
    <img :src="lightbox.url" :alt="lightbox.alt" class="max-h-full max-w-full rounded object-contain shadow-2xl" />
    <button
      type="button"
      class="absolute right-6 top-6 cursor-pointer text-2xl leading-none text-white/80 transition-colors hover:text-white"
      @click="lightbox.close()"
    >
      ✕
    </button>
  </div>
</template>
