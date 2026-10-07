import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import TicketFilters from '../TicketFilters.vue'
import TicketTable from '../TicketTable.vue'
import { useTicketsStore } from '../../../stores/tickets.store'
import { usePartnersStore } from '../../../stores/partners.store'
import type { Ticket } from '../../../types'

function makeTicket(id: string, overrides: Partial<Ticket> = {}): Ticket {
  return {
    id,
    photoId: id,
    style: id,
    productNumber: '000',
    basePhotos: { front: '/front.jpg' },
    colourVariants: [{ id: 'v1', name: 'Granita', type: 'solid', pantone: 'Granita', decision: 'pending' }],
    priority: 'Medium',
    partnerId: 'p1',
    status: 'Pending',
    createdBy: 'Operator',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('ticket status/priority/partner filters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('filters the table by status', async () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [
      makeTicket('pending-1', { status: 'Pending' }),
      makeTicket('sent-1', { status: 'Sent' }),
    ]
    ticketsStore.loaded = true
    usePartnersStore().loaded = true

    const filters = mount(TicketFilters)
    const table = mount(TicketTable, { props: { tickets: ticketsStore.filteredTickets } })

    const statusSelect = filters.findAll('select')[0]
    await statusSelect.setValue('Sent')
    await table.setProps({ tickets: ticketsStore.filteredTickets })

    const rows = table.findAll('tbody tr')
    expect(rows.length).toBe(1)
    expect(table.text()).toContain('sent-1')
    expect(table.text()).not.toContain('pending-1')
  })

  it('filters the table by priority', async () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [
      makeTicket('low-1', { priority: 'Low' }),
      makeTicket('urgent-1', { priority: 'Urgent' }),
    ]
    ticketsStore.loaded = true
    usePartnersStore().loaded = true

    const filters = mount(TicketFilters)
    const table = mount(TicketTable, { props: { tickets: ticketsStore.filteredTickets } })

    const prioritySelect = filters.findAll('select')[1]
    await prioritySelect.setValue('Urgent')
    await table.setProps({ tickets: ticketsStore.filteredTickets })

    const rows = table.findAll('tbody tr')
    expect(rows.length).toBe(1)
    expect(table.text()).toContain('urgent-1')
    expect(table.text()).not.toContain('low-1')
  })

  it('filters the table by partner', async () => {
    const ticketsStore = useTicketsStore()
    const partnersStore = usePartnersStore()
    partnersStore.partners = [
      { id: 'p1', name: 'Partner One' },
      { id: 'p2', name: 'Partner Two' },
    ]
    partnersStore.loaded = true
    ticketsStore.tickets = [
      makeTicket('p1-ticket', { partnerId: 'p1' }),
      makeTicket('p2-ticket', { partnerId: 'p2' }),
    ]
    ticketsStore.loaded = true

    const filters = mount(TicketFilters)
    const table = mount(TicketTable, { props: { tickets: ticketsStore.filteredTickets } })

    const partnerSelect = filters.findAll('select')[2]
    await partnerSelect.setValue('p2')
    await table.setProps({ tickets: ticketsStore.filteredTickets })

    const rows = table.findAll('tbody tr')
    expect(rows.length).toBe(1)
    expect(table.text()).toContain('p2-ticket')
    expect(table.text()).not.toContain('p1-ticket')
  })

  it('clears all filters via the Clear filters button', async () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [makeTicket('a'), makeTicket('b')]
    ticketsStore.loaded = true
    usePartnersStore().loaded = true
    ticketsStore.filters = { status: 'Pending' }

    const filters = mount(TicketFilters)
    const clearButton = filters.findAll('button').find((b) => b.text() === 'Clear filters')
    expect(clearButton).toBeTruthy()
    await clearButton!.trigger('click')

    expect(ticketsStore.filters).toEqual({})
  })
})
