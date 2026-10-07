<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { usePartnersStore } from '../../stores/partners.store'
import { useRoleStore } from '../../stores/role.store'
import { useTicketsStore } from '../../stores/tickets.store'
import { useLightboxStore } from '../../stores/lightbox.store'
import { useEscapeKey } from '../../composables/useEscapeKey'
import StatusBadge from '../badges/StatusBadge.vue'
import PriorityBadge from '../badges/PriorityBadge.vue'
import PhotoUploadField from './PhotoUploadField.vue'
import type { ColourVariant, VariantType } from '../../types'

const props = defineProps<{ ticketId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const ticketsStore = useTicketsStore()
const partnersStore = usePartnersStore()
const roleStore = useRoleStore()
const lightbox = useLightboxStore()

const ticket = computed(() => ticketsStore.tickets.find((t) => t.id === props.ticketId) ?? null)
const partnerName = computed(
  () => partnersStore.partners.find((p) => p.id === ticket.value?.partnerId)?.name ?? '—',
)

useEscapeKey(() => {
  if (ticket.value) emit('close')
})

const busy = ref(false)
const rejectingVariantId = ref<string | null>(null)
const rejectReason = ref('')

async function run(action: () => Promise<void>) {
  busy.value = true
  try {
    await action()
  } catch {
    // Already surfaced as a toast by the store; nothing more to do here.
  } finally {
    busy.value = false
  }
}

async function onApprove(variant: ColourVariant) {
  if (!ticket.value) return
  await run(() => ticketsStore.approveVariant(ticket.value!.id, variant.id, variant.name))
}

function startReject(variantId: string) {
  rejectingVariantId.value = variantId
  rejectReason.value = ''
}

async function confirmReject(variant: ColourVariant) {
  if (!ticket.value || !rejectReason.value.trim()) return
  await run(() => ticketsStore.rejectVariant(ticket.value!.id, variant.id, variant.name, rejectReason.value.trim()))
  rejectingVariantId.value = null
  rejectReason.value = ''
}

const addingColour = ref(false)
const newVariant = reactive({ name: '', type: 'solid' as VariantType, pantone: '', referenceImage: null as File | null })

function resetNewVariant() {
  newVariant.name = ''
  newVariant.type = 'solid'
  newVariant.pantone = ''
  newVariant.referenceImage = null
  addingColour.value = false
}

async function submitNewVariant() {
  if (!ticket.value || !newVariant.name.trim()) return
  const data = new FormData()
  data.set('name', newVariant.name.trim())
  data.set('type', newVariant.type)
  if (newVariant.type === 'solid' && newVariant.pantone) data.set('pantone', newVariant.pantone)
  if (newVariant.type === 'aop' && newVariant.referenceImage) data.set('variantRef', newVariant.referenceImage)

  await run(() => ticketsStore.addColourVariant(ticket.value!.id, data))
  resetNewVariant()
}
</script>

<template>
  <div v-if="ticket" class="fixed inset-0 z-20 flex justify-end bg-black/30" @click.self="emit('close')">
    <div class="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl">
      <div class="mb-4 flex items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">{{ ticket.photoId }}</h2>
          <p class="text-sm text-gray-500">{{ partnerName }}</p>
        </div>
        <button
          type="button"
          class="cursor-pointer text-gray-400 transition-colors hover:text-gray-700"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <div class="mb-4 flex items-center gap-2">
        <StatusBadge :status="ticket.status" />
        <PriorityBadge :priority="ticket.priority" />
      </div>

      <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Style (original photos)</p>
      <div class="mb-4 grid grid-cols-3 gap-2">
        <div>
          <img
            :src="ticket.basePhotos.front"
            alt="front"
            class="aspect-[3/4] w-full cursor-zoom-in rounded object-cover transition-opacity hover:opacity-80"
            @click="lightbox.open(ticket.basePhotos.front, `${ticket.photoId} — front`)"
          />
          <p class="mt-1 text-center text-xs text-gray-500">Front</p>
        </div>
        <div v-if="ticket.basePhotos.back">
          <img
            :src="ticket.basePhotos.back"
            alt="back"
            class="aspect-[3/4] w-full cursor-zoom-in rounded object-cover transition-opacity hover:opacity-80"
            @click="lightbox.open(ticket.basePhotos.back, `${ticket.photoId} — back`)"
          />
          <p class="mt-1 text-center text-xs text-gray-500">Back</p>
        </div>
        <div v-if="ticket.basePhotos.detail">
          <img
            :src="ticket.basePhotos.detail"
            alt="detail"
            class="aspect-[3/4] w-full cursor-zoom-in rounded object-cover transition-opacity hover:opacity-80"
            @click="lightbox.open(ticket.basePhotos.detail, `${ticket.photoId} — detail`)"
          />
          <p class="mt-1 text-center text-xs text-gray-500">Detail</p>
        </div>
      </div>

      <h3 class="mb-2 text-sm font-medium text-gray-700">Requested colours</h3>
      <ul class="mb-2 space-y-2">
        <li
          v-for="variant in ticket.colourVariants"
          :key="variant.id"
          class="rounded-md border border-gray-200 p-2 text-sm"
        >
          <div class="flex items-center gap-3">
            <img
              v-if="variant.referenceImagePath"
              :src="variant.referenceImagePath"
              alt=""
              class="h-10 w-10 shrink-0 cursor-zoom-in rounded object-cover transition-opacity hover:opacity-80"
              @click="lightbox.open(variant.referenceImagePath, variant.name)"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-gray-900">{{ variant.name }}</p>
              <p class="text-xs text-gray-500">{{ variant.type === 'solid' ? variant.pantone : 'AOP pattern' }}</p>
            </div>
            <span
              v-if="variant.decision === 'approved'"
              class="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
            >
              Approved
            </span>
            <span
              v-else-if="variant.decision === 'rejected'"
              class="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
            >
              Rejected
            </span>

            <template v-if="variant.decision === 'pending' && ticket.status === 'Completed' && roleStore.isManager">
              <button
                type="button"
                :disabled="busy"
                class="shrink-0 cursor-pointer rounded bg-green-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                @click="onApprove(variant)"
              >
                Approve
              </button>
              <button
                type="button"
                class="shrink-0 cursor-pointer rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
                @click="startReject(variant.id)"
              >
                Reject
              </button>
            </template>
          </div>

          <p v-if="variant.decision === 'rejected' && variant.decisionReason" class="mt-1.5 rounded bg-red-50 p-1.5 text-xs text-red-700">
            {{ variant.decisionReason }}
          </p>

          <div v-if="rejectingVariantId === variant.id" class="mt-2 space-y-1.5">
            <textarea
              v-model="rejectReason"
              rows="2"
              placeholder="Reason for rejecting this colour"
              class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs transition-colors focus:border-gray-400"
            />
            <div class="flex gap-1.5">
              <button
                type="button"
                :disabled="busy || !rejectReason.trim()"
                class="flex-1 cursor-pointer rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                @click="confirmReject(variant)"
              >
                {{ busy ? 'Rejecting…' : 'Confirm reject' }}
              </button>
              <button
                type="button"
                class="flex-1 cursor-pointer rounded-md border border-gray-300 px-2 py-1 text-xs transition-colors hover:bg-gray-50"
                @click="rejectingVariantId = null"
              >
                Cancel
              </button>
            </div>
          </div>
        </li>
      </ul>

      <div v-if="roleStore.isOperator" class="mb-4">
        <button
          v-if="!addingColour"
          type="button"
          class="cursor-pointer text-sm font-medium text-gray-900 transition-colors hover:text-gray-600 hover:underline"
          @click="addingColour = true"
        >
          + Add colour
        </button>
        <div v-else class="space-y-2 rounded-md border border-gray-200 p-2">
          <input
            v-model="newVariant.name"
            type="text"
            placeholder="Colour / pattern name"
            class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <select v-model="newVariant.type" class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="solid">Solid (Pantone)</option>
            <option value="aop">AOP (pattern)</option>
          </select>
          <input
            v-if="newVariant.type === 'solid'"
            v-model="newVariant.pantone"
            type="text"
            placeholder="Pantone code / name"
            class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <PhotoUploadField
            v-else
            v-model="newVariant.referenceImage"
            label="Reference swatch image"
            compact
          />
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="busy || !newVariant.name.trim()"
              class="flex-1 cursor-pointer rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              @click="submitNewVariant"
            >
              {{ busy ? 'Adding…' : 'Add colour' }}
            </button>
            <button
              type="button"
              class="flex-1 cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50"
              @click="resetNewVariant"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <p v-if="ticket.notes" class="mb-4 rounded-md bg-gray-50 p-2 text-xs text-gray-600">{{ ticket.notes }}</p>

      <div v-if="ticket.partnerReceipt" class="mb-4 text-xs text-gray-500">
        Receipt: {{ ticket.partnerReceipt.receiptStatus }}
        <span v-if="ticket.partnerReceipt.sentAt"> · sent {{ new Date(ticket.partnerReceipt.sentAt).toLocaleTimeString() }}</span>
      </div>

      <div class="space-y-2">
        <button
          v-if="ticket.status === 'Pending'"
          :disabled="busy"
          class="w-full cursor-pointer rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          @click="run(() => ticketsStore.sendToPartner(ticket!.id))"
        >
          {{ busy ? 'Sending…' : 'Send to partner' }}
        </button>

        <button
          v-if="ticket.status === 'In Progress'"
          :disabled="busy"
          class="w-full cursor-pointer rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          @click="run(() => ticketsStore.completeTicket(ticket!.id))"
        >
          {{ busy ? 'Completing…' : 'Simulate complete' }}
        </button>

        <button
          v-if="ticket.status === 'Rejected'"
          :disabled="busy"
          class="w-full cursor-pointer rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          @click="run(() => ticketsStore.requeueTicket(ticket!.id))"
        >
          {{ busy ? 'Returning…' : 'Return to queue' }}
        </button>
      </div>
    </div>
  </div>
</template>
