<script setup lang="ts">
import type { VariantType } from '../../types'
import PhotoUploadField from './PhotoUploadField.vue'

export interface VariantDraft {
  name: string
  type: VariantType
  pantone: string
  referenceImage: File | null
}

const model = defineModel<VariantDraft>({ required: true })

defineProps<{ index: number }>()
const emit = defineEmits<{ remove: [] }>()
</script>

<template>
  <div class="grid grid-cols-12 items-start gap-2 rounded-md border border-gray-200 p-3">
    <div class="col-span-4">
      <label class="mb-1 block text-xs text-gray-500">Colour / pattern name</label>
      <input
        v-model="model.name"
        type="text"
        required
        placeholder="e.g. Granita"
        class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
    </div>
    <div class="col-span-3">
      <label class="mb-1 block text-xs text-gray-500">Type</label>
      <select v-model="model.type" class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
        <option value="solid">Solid (Pantone)</option>
        <option value="aop">AOP (pattern)</option>
      </select>
    </div>
    <div class="col-span-4">
      <template v-if="model.type === 'solid'">
        <label class="mb-1 block text-xs text-gray-500">Pantone code / name</label>
        <input
          v-model="model.pantone"
          type="text"
          placeholder="e.g. Hedge Green"
          class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </template>
      <template v-else>
        <PhotoUploadField v-model="model.referenceImage" label="Reference swatch image" compact />
      </template>
    </div>
    <div class="col-span-1 flex justify-end pt-5">
      <button
        type="button"
        class="cursor-pointer text-sm text-gray-400 transition-colors hover:text-red-600"
        title="Remove variant"
        @click="emit('remove')"
      >
        ✕
      </button>
    </div>
  </div>
</template>
