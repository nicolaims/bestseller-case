<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePartnersStore } from '../../stores/partners.store'
import { useTicketsStore } from '../../stores/tickets.store'
import ColourVariantRow from './ColourVariantRow.vue'
import type { VariantDraft } from './ColourVariantRow.vue'
import PhotoUploadField from './PhotoUploadField.vue'
import type { Priority } from '../../types'

const partnersStore = usePartnersStore()
const ticketsStore = useTicketsStore()
const router = useRouter()

onMounted(() => {
  if (!partnersStore.loaded) partnersStore.fetchPartners()
})

const form = reactive({
  style: '',
  productNumber: '',
  priority: 'Medium' as Priority,
  partnerId: '',
  notes: '',
})

const variants = ref<VariantDraft[]>([{ name: '', type: 'solid', pantone: '', referenceImage: null }])
const frontPhoto = ref<File | null>(null)
const backPhoto = ref<File | null>(null)
const detailPhoto = ref<File | null>(null)
const submitting = ref(false)
const error = ref('')

function addVariant() {
  variants.value.push({ name: '', type: 'solid', pantone: '', referenceImage: null })
}

function removeVariant(index: number) {
  variants.value.splice(index, 1)
}

async function onSubmit() {
  error.value = ''
  if (!frontPhoto.value) {
    error.value = 'A front photo is required.'
    return
  }

  const data = new FormData()
  data.set('style', form.style)
  data.set('productNumber', form.productNumber)
  data.set('priority', form.priority)
  data.set('partnerId', form.partnerId)
  data.set('notes', form.notes)
  data.set('front', frontPhoto.value)
  if (backPhoto.value) data.set('back', backPhoto.value)
  if (detailPhoto.value) data.set('detail', detailPhoto.value)

  data.set(
    'colourVariants',
    JSON.stringify(variants.value.map((v) => ({ name: v.name, type: v.type, pantone: v.pantone || undefined }))),
  )
  variants.value.forEach((v, index) => {
    if (v.type === 'aop' && v.referenceImage) data.set(`variantRef_${index}`, v.referenceImage)
  })

  submitting.value = true
  try {
    await ticketsStore.createTicket(data)
    router.push({ name: 'queue' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create ticket.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="max-w-3xl space-y-6" @submit.prevent="onSubmit">
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">Style number</label>
        <input
          v-model="form.style"
          type="text"
          required
          placeholder="e.g. 15377489"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">Product number</label>
        <input
          v-model="form.productNumber"
          type="text"
          required
          placeholder="e.g. 5081878"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <PhotoUploadField v-model="frontPhoto" label="Front photo" required />
      <PhotoUploadField v-model="backPhoto" label="Back photo" />
      <PhotoUploadField v-model="detailPhoto" label="Detail photo" />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">Priority</label>
        <select v-model="form.priority" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
          <option>Urgent</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">Partner</label>
        <select v-model="form.partnerId" required class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="" disabled>Select a partner</option>
          <option v-for="partner in partnersStore.partners" :key="partner.id" :value="partner.id">
            {{ partner.name }}
          </option>
        </select>
      </div>
    </div>

    <div>
      <div class="mb-2 flex items-center justify-between">
        <label class="block text-sm font-medium text-gray-700">Requested colour variants</label>
        <button
          type="button"
          class="cursor-pointer text-sm font-medium text-gray-900 transition-colors hover:text-gray-600 hover:underline"
          @click="addVariant"
        >
          + Add colour variant
        </button>
      </div>
      <div class="space-y-2">
        <ColourVariantRow
          v-for="(_, index) in variants"
          :key="index"
          v-model="variants[index]"
          :index="index"
          @remove="removeVariant(index)"
        />
      </div>
    </div>

    <div>
      <label class="mb-1 block text-sm font-medium text-gray-700">Notes</label>
      <textarea
        v-model="form.notes"
        rows="2"
        placeholder="e.g. Keep clipping path (only 1)."
        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <button
      type="submit"
      :disabled="submitting"
      class="cursor-pointer rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {{ submitting ? 'Creating…' : 'Create ticket' }}
    </button>
  </form>
</template>
