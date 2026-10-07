<script setup lang="ts">
import { ref } from 'vue'
import Sidebar from '../components/nav/Sidebar.vue'
import ToastContainer from '../components/nav/ToastContainer.vue'
import Lightbox from '../components/nav/Lightbox.vue'

const sidebarOpen = ref(false)
</script>

<template>
  <div class="flex min-h-screen bg-gray-50">
    <Sidebar v-model:open="sidebarOpen" />

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex items-center border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          class="cursor-pointer rounded-md p-1 text-gray-600 hover:bg-gray-100"
          @click="sidebarOpen = true"
        >
          <span class="text-xl leading-none">☰</span>
        </button>
        <span class="ml-3 font-semibold text-gray-900">Recolour Requests</span>
      </header>
      <main class="flex-1 overflow-y-auto p-4 sm:p-8">
        <RouterView />
      </main>
    </div>

    <ToastContainer />
    <Lightbox />
  </div>
</template>
