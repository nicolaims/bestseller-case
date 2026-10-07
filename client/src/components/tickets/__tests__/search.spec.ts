import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import TicketFilters from '../TicketFilters.vue'
import TicketTable from '../TicketTable.vue'
import { useTicketsStore } from '../../../stores/tickets.store'
import { usePartnersStore } from '../../../stores/partners.store'
import type { Ticket } from '../../../types'

function makeTicket(photoId: string): Ticket {
  const [style, productNumber] = photoId.split('_')
  return {
    id: photoId,
    photoId,
    style,
    productNumber,
    basePhotos: { front: '/front.jpg' },
    colourVariants: [{ id: 'v1', name: 'Granita', type: 'solid', pantone: 'Granita', decision: 'pending' }],
    priority: 'Medium',
    partnerId: 'p1',
    status: 'Pending',
    createdBy: 'Operator',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('ticket search filter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('filters the table as the user types a partial match', async () => {
    const ticketsStore = useTicketsStore()
    ticketsStore.tickets = [makeTicket('15377489_5081878'), makeTicket('99999999_1234567')]
    ticketsStore.loaded = true
    usePartnersStore().loaded = true // avoid an unrelated network fetch from TicketFilters' onMounted

    const filters = mount(TicketFilters)
    const table = mount(TicketTable, { props: { tickets: ticketsStore.filteredTickets } })

    expect(table.findAll('tbody tr').length).toBe(2)

    const input = filters.find('input[type="text"]')
    await input.setValue('153')

    // Re-read the getter after the store mutation and re-render the table with it.
    await table.setProps({ tickets: ticketsStore.filteredTickets })

    const rows = table.findAll('tbody tr')
    expect(rows.length).toBe(1)
    expect(table.text()).toContain('15377489_5081878')
    expect(table.text()).not.toContain('99999999_1234567')
  })
})
