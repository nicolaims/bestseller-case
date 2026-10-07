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
      { id: 'v1', name: 'Granita', type: 'solid', pantone: 'Granita', decision: 'pending' },
      { id: 'v2', name: 'Fuchsia', type: 'solid', pantone: 'Fuchsia', decision: 'pending' },
    ],
    priority: 'Medium',
    partnerId: 'p1',
    status: 'Completed',
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

describe('TicketDetailDrawer — approve/reject flow', () => {
  it('lets a Manager approve a pending variant on a Completed ticket', async () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [makeTicket()]
    useRoleStore().setRole('Manager')
    const approveSpy = vi.spyOn(ticketsStore, 'approveVariant').mockResolvedValue({} as never)

    const wrapper = mount(TicketDetailDrawer, { props: { ticketId: 't1' } })
    const approveButton = wrapper.findAll('button').find((b) => b.text() === 'Approve')
    expect(approveButton).toBeTruthy()
    await approveButton!.trigger('click')

    expect(approveSpy).toHaveBeenCalledWith('t1', 'v1', 'Granita')
  })

  it('lets a Manager reject a variant after entering a reason', async () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [makeTicket()]
    useRoleStore().setRole('Manager')
    const rejectSpy = vi.spyOn(ticketsStore, 'rejectVariant').mockResolvedValue({} as never)

    const wrapper = mount(TicketDetailDrawer, { props: { ticketId: 't1' } })
    const rejectButton = wrapper.findAll('button').find((b) => b.text() === 'Reject')
    await rejectButton!.trigger('click')

    const textarea = wrapper.find('textarea')
    await textarea.setValue('Wrong tone')
    const confirmButton = wrapper.findAll('button').find((b) => b.text().includes('Confirm reject'))
    await confirmButton!.trigger('click')

    expect(rejectSpy).toHaveBeenCalledWith('t1', 'v1', 'Granita', 'Wrong tone')
  })

  it('does not show approve/reject actions to an Operator', () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [makeTicket()]
    useRoleStore().setRole('Operator')

    const wrapper = mount(TicketDetailDrawer, { props: { ticketId: 't1' } })
    expect(wrapper.findAll('button').some((b) => b.text() === 'Approve')).toBe(false)
  })
})

describe('TicketDetailDrawer — per-variant requeue', () => {
  it('shows a requeue action for a rejected variant even though the ticket overall is Approved', () => {
    const ticketsStore = useTicketsStore()
    const ticket = makeTicket({ status: 'Approved' })
    ticket.colourVariants[0].decision = 'approved'
    ticket.colourVariants[1].decision = 'rejected'
    ticket.colourVariants[1].decisionReason = 'Colour off'
    ticketsStore.tickets = [ticket]

    const wrapper = mount(TicketDetailDrawer, { props: { ticketId: 't1' } })

    const requeueButton = wrapper.findAll('button').find((b) => b.text() === 'Requeue this colour')
    expect(requeueButton).toBeTruthy()
  })

  it('calls ticketsStore.requeueVariant scoped to that one variant', async () => {
    const ticketsStore = useTicketsStore()
    const ticket = makeTicket({ status: 'Approved' })
    ticket.colourVariants[0].decision = 'approved'
    ticket.colourVariants[1].decision = 'rejected'
    ticketsStore.tickets = [ticket]
    const requeueSpy = vi.spyOn(ticketsStore, 'requeueVariant').mockResolvedValue(undefined as never)

    const wrapper = mount(TicketDetailDrawer, { props: { ticketId: 't1' } })
    const requeueButton = wrapper.findAll('button').find((b) => b.text() === 'Requeue this colour')
    await requeueButton!.trigger('click')

    expect(requeueSpy).toHaveBeenCalledWith('t1', 'v2')
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
