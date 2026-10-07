<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ label: string; required?: boolean; compact?: boolean }>()
const model = defineModel<File | null>({ default: null })

const inputRef = ref<HTMLInputElement>()
const previewUrl = ref<string | null>(null)
const dragOver = ref(false)

watch(
  model,
  (file) => {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = file ? URL.createObjectURL(file) : null
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

const fileSize = computed(() => (model.value ? `${(model.value.size / 1024 / 1024).toFixed(1)} MB` : ''))

function onChange(event: Event) {
  model.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) model.value = file
}

function clear() {
  model.value = null
  if (inputRef.value) inputRef.value.value = ''
}
</script>

<template>
  <div>
    <label class="mb-1 block text-sm font-medium text-gray-700">
      {{ label }}<span v-if="required" class="text-red-500"> *</span>
    </label>

    <label
      v-if="!model && !compact"
      class="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-3 py-6 text-center transition-colors"
      :class="dragOver ? 'border-gray-500 bg-gray-100' : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <span class="text-xl leading-none text-gray-400">⬆</span>
      <span class="text-sm font-medium text-gray-700">{{ dragOver ? 'Drop to upload' : 'Click or drag to upload' }}</span>
      <span class="text-xs text-gray-400">JPG or PNG, up to 25MB</span>
      <input ref="inputRef" type="file" accept="image/*" class="sr-only" @change="onChange" />
    </label>

    <label
      v-else-if="!model && compact"
      class="flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-xs font-medium transition-colors"
      :class="dragOver ? 'border-gray-500 bg-gray-100 text-gray-800' : 'border-gray-300 bg-gray-50 text-gray-600 hover:border-gray-400 hover:bg-gray-100'"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <span class="leading-none text-gray-400">⬆</span>
      {{ dragOver ? 'Drop image' : 'Upload image' }}
      <input ref="inputRef" type="file" accept="image/*" class="sr-only" @change="onChange" />
    </label>

    <div
      v-else
      class="flex items-center gap-2 rounded-md border border-gray-300 bg-white"
      :class="compact ? 'p-1.5' : 'p-2 gap-3'"
    >
      <img :src="previewUrl ?? ''" alt="" class="shrink-0 rounded object-cover" :class="compact ? 'h-8 w-7' : 'h-14 w-11'" />
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium text-gray-900" :class="compact ? 'text-xs' : 'text-sm'">{{ model!.name }}</p>
        <p v-if="!compact" class="text-xs text-gray-400">{{ fileSize }}</p>
      </div>
      <button
        type="button"
        class="cursor-pointer rounded px-1.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-600"
        @click="clear"
      >
        Remove
      </button>
    </div>
  </div>
</template>
