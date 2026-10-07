import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import TicketForm from '../TicketForm.vue'
import { usePartnersStore } from '../../../stores/partners.store'
import { useTicketsStore } from '../../../stores/tickets.store'

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

function attachFile(input: HTMLInputElement, file: File) {
  const dataTransfer = new DataTransfer()
  dataTransfer.items.add(file)
  Object.defineProperty(input, 'files', { value: dataTransfer.files, configurable: true })
}

beforeEach(() => {
  setActivePinia(createPinia())
  pushMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TicketForm', () => {
  it('blocks submission and shows an error when there is no front photo', async () => {
    const partnersStore = usePartnersStore()
    partnersStore.partners = [{ id: 'p1', name: 'Partner One' }]
    partnersStore.loaded = true
    const ticketsStore = useTicketsStore()
    const createSpy = vi.spyOn(ticketsStore, 'createTicket')

    const wrapper = mount(TicketForm)
    await wrapper.find('input[placeholder="e.g. 15377489"]').setValue('15377489')
    await wrapper.find('input[placeholder="e.g. 5081878"]').setValue('5081878')
    await wrapper.find('select[required]').setValue('p1')
    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('A front photo is required.')
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('submits a FormData payload with the front photo and navigates to the queue on success', async () => {
    const partnersStore = usePartnersStore()
    partnersStore.partners = [{ id: 'p1', name: 'Partner One' }]
    partnersStore.loaded = true
    const ticketsStore = useTicketsStore()
    const createSpy = vi.spyOn(ticketsStore, 'createTicket').mockResolvedValue({} as never)

    const wrapper = mount(TicketForm)
    await wrapper.find('input[placeholder="e.g. 15377489"]').setValue('15377489')
    await wrapper.find('input[placeholder="e.g. 5081878"]').setValue('5081878')
    await wrapper.find('select[required]').setValue('p1')

    const file = new File(['front'], 'front.jpg', { type: 'image/jpeg' })
    const fileInput = wrapper.find('input[type="file"]').element as HTMLInputElement
    attachFile(fileInput, file)
    await wrapper.find('input[type="file"]').trigger('change')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(createSpy).toHaveBeenCalledTimes(1)
    const formData = createSpy.mock.calls[0][0] as FormData
    expect(formData.get('style')).toBe('15377489')
    expect(formData.get('productNumber')).toBe('5081878')
    expect(formData.get('partnerId')).toBe('p1')
    expect(formData.get('front')).toBeInstanceOf(File)
    expect(pushMock).toHaveBeenCalledWith({ name: 'queue' })
  })
})

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
