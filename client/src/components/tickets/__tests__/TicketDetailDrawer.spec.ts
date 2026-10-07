import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import TicketDetailDrawer from '../TicketDetailDrawer.vue'
import { useTicketsStore } from '../../../stores/tickets.store'
import { useRoleStore } from '../../../stores/role.store'
import type { Ticket } from '../../../types'

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  const now = new Date().toISOString()
  return {
    id: 't1',
    photoId: 'ABC_123',
    style: 'ABC',
    productNumber: '123',
    basePhotos: { front: '/front.jpg' },
    colourVariants: [
      { id: 'v1', name: 'Granita', type: 'solid', pantone: 'Granita' },
      { id: 'v2', name: 'Fuchsia', type: 'solid', pantone: 'Fuchsia' },
    ],
    priority: 'Medium',
    partnerId: 'p1',
    status: 'Pending',
    createdBy: 'Operator',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TicketDetailDrawer — ticket approve/reject flow', () => {
  it('lets a Manager approve a Pending ticket', async () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [makeTicket()]
    useRoleStore().setRole('Manager')
    const approveSpy = vi.spyOn(ticketsStore, 'approveTicket').mockResolvedValue(undefined as never)

    const wrapper = mount(TicketDetailDrawer, { props: { ticketId: 't1' } })
    const approveButton = wrapper.findAll('button').find((b) => b.text() === 'Approve ticket')
    expect(approveButton).toBeTruthy()
    await approveButton!.trigger('click')

    expect(approveSpy).toHaveBeenCalledWith('t1')
  })

  it('lets a Manager reject a ticket after entering a reason', async () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [makeTicket()]
    useRoleStore().setRole('Manager')
    const rejectSpy = vi.spyOn(ticketsStore, 'rejectTicket').mockResolvedValue(undefined as never)

    const wrapper = mount(TicketDetailDrawer, { props: { ticketId: 't1' } })
    const rejectButton = wrapper.findAll('button').find((b) => b.text() === 'Reject ticket')
    await rejectButton!.trigger('click')

    const textarea = wrapper.find('textarea')
    await textarea.setValue('Wrong tone')
    const confirmButton = wrapper.findAll('button').find((b) => b.text().includes('Confirm reject'))
    await confirmButton!.trigger('click')

    expect(rejectSpy).toHaveBeenCalledWith('t1', 'Wrong tone')
  })

  it('does not show approve/reject actions to an Operator', () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [makeTicket()]
    useRoleStore().setRole('Operator')

    const wrapper = mount(TicketDetailDrawer, { props: { ticketId: 't1' } })
    expect(wrapper.findAll('button').some((b) => b.text() === 'Approve ticket')).toBe(false)
  })

  it('does not show approve/reject actions once the ticket is past Pending', () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [makeTicket({ status: 'Approved' })]
    useRoleStore().setRole('Manager')

    const wrapper = mount(TicketDetailDrawer, { props: { ticketId: 't1' } })
    expect(wrapper.findAll('button').some((b) => b.text() === 'Approve ticket')).toBe(false)
  })

  it('shows the Manager rejection reason on a bounced-back Pending ticket', () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [makeTicket({ lastRejectionReason: 'Wrong tone' })]

    const wrapper = mount(TicketDetailDrawer, { props: { ticketId: 't1' } })
    expect(wrapper.text()).toContain('Rejected by the Manager: Wrong tone')
  })

  it('only offers "Send to partner" once the ticket is Approved', () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [makeTicket({ status: 'Pending' })]

    const pendingWrapper = mount(TicketDetailDrawer, { props: { ticketId: 't1' } })
    expect(pendingWrapper.findAll('button').some((b) => b.text() === 'Send to partner')).toBe(false)

    ticketsStore.tickets = [makeTicket({ status: 'Approved' })]
    const approvedWrapper = mount(TicketDetailDrawer, { props: { ticketId: 't1' } })
    expect(approvedWrapper.findAll('button').some((b) => b.text() === 'Send to partner')).toBe(true)
  })
})

describe('TicketDetailDrawer — stuck Sent tickets', () => {
  it('offers a Force acknowledge action for a ticket stuck on Sent', () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [makeTicket({ status: 'Sent', partnerReceipt: { receiptStatus: 'Pending' } })]

    const wrapper = mount(TicketDetailDrawer, { props: { ticketId: 't1' } })
    expect(wrapper.findAll('button').some((b) => b.text() === 'Force acknowledge')).toBe(true)
  })

  it('calls ticketsStore.forceAcknowledge when clicked', async () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [makeTicket({ status: 'Sent', partnerReceipt: { receiptStatus: 'Rejected' } })]
    const forceSpy = vi.spyOn(ticketsStore, 'forceAcknowledge').mockResolvedValue(undefined as never)

    const wrapper = mount(TicketDetailDrawer, { props: { ticketId: 't1' } })
    const button = wrapper.findAll('button').find((b) => b.text() === 'Force acknowledge')
    await button!.trigger('click')

    expect(forceSpy).toHaveBeenCalledWith('t1')
  })
})
