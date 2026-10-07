<script setup lang="ts">
import { useRoleStore } from '../../stores/role.store'

const roleStore = useRoleStore()
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
    <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Viewing as</p>
    <div class="flex gap-1 rounded-md bg-gray-200 p-1">
      <button
        v-for="role in (['Operator', 'Manager'] as const)"
        :key="role"
        class="flex-1 cursor-pointer rounded px-2 py-1 text-sm font-medium transition-colors"
        :class="
          roleStore.role === role
            ? 'bg-white text-gray-900 shadow'
            : 'text-gray-600 hover:bg-gray-100/60 hover:text-gray-900'
        "
        @click="roleStore.setRole(role)"
      >
        {{ role }}
      </button>
    </div>
  </div>
</template>
