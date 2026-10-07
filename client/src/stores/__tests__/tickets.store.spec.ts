import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '../../api/client'
import type { Ticket } from '../../types'

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }))

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>()
  return {
    ...actual,
    api: { get: getMock, post: postMock, patch: vi.fn() },
  }
})

const { useTicketsStore } = await import('../tickets.store')
const { useNotificationsStore } = await import('../notifications.store')

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  const now = new Date().toISOString()
  return {
    id: 't1',
    photoId: 'ABC_123',
    style: 'ABC',
    productNumber: '123',
    basePhotos: { front: '/front.jpg' },
    colourVariants: [{ id: 'v1', name: 'Granita', type: 'solid', pantone: 'Granita' }],
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
  getMock.mockReset()
  postMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('filteredTickets', () => {
  it('filters by status, priority, and partner together', () => {
    const store = useTicketsStore()
    store.tickets = [
      makeTicket({ id: 'a', status: 'Pending', priority: 'High', partnerId: 'p1' }),
      makeTicket({ id: 'b', status: 'Sent', priority: 'High', partnerId: 'p1' }),
      makeTicket({ id: 'c', status: 'Pending', priority: 'Low', partnerId: 'p2' }),
    ]

    store.filters = { status: 'Pending' }
    expect(store.filteredTickets.map((t) => t.id).sort()).toEqual(['a', 'c'])

    store.filters = { status: 'Pending', priority: 'High' }
    expect(store.filteredTickets.map((t) => t.id)).toEqual(['a'])

    store.filters = { partnerId: 'p2' }
    expect(store.filteredTickets.map((t) => t.id)).toEqual(['c'])
  })
})

describe('fetchTickets', () => {
  it('populates tickets on success', async () => {
    const store = useTicketsStore()
    getMock.mockResolvedValueOnce([makeTicket()])

    await store.fetchTickets()

    expect(store.tickets).toHaveLength(1)
    expect(store.loaded).toBe(true)
    expect(store.loadError).toBeNull()
  })

  it('surfaces a load error and a toast instead of leaving a silent blank list', async () => {
    const store = useTicketsStore()
    const notifications = useNotificationsStore()
    getMock.mockRejectedValueOnce(new ApiError(500, 'Server exploded'))

    await store.fetchTickets()

    expect(store.loadError).toBe('Server exploded')
    expect(notifications.toasts.some((t) => t.type === 'error' && t.message === 'Server exploded')).toBe(true)
  })
})

describe('approve / reject flow', () => {
  it('replaces the ticket and pushes a success toast on approve', async () => {
    const store = useTicketsStore()
    const notifications = useNotificationsStore()
    store.tickets = [makeTicket({ status: 'Pending' })]
    const approved = makeTicket({ status: 'Approved' })
    postMock.mockResolvedValueOnce({ ticket: approved, approvedPhoto: { id: 'ap1', ticketId: 't1', approvedBy: 'Manager', approvedAt: new Date().toISOString() } })

    await store.approveTicket('t1')

    expect(postMock).toHaveBeenCalledWith('/tickets/t1/approve')
    expect(store.tickets[0].status).toBe('Approved')
    expect(notifications.toasts.some((t) => t.type === 'success')).toBe(true)
  })

  it('pushes an error toast and rethrows when reject fails', async () => {
    const store = useTicketsStore()
    const notifications = useNotificationsStore()
    store.tickets = [makeTicket({ status: 'Pending' })]
    postMock.mockRejectedValueOnce(new ApiError(409, 'Ticket must be Pending to be reviewed'))

    await expect(store.rejectTicket('t1', 'wrong tone')).rejects.toThrow('Ticket must be Pending to be reviewed')
    expect(postMock).toHaveBeenCalledWith('/tickets/t1/reject', { reason: 'wrong tone' })
    expect(notifications.toasts.some((t) => t.type === 'error' && t.message === 'Ticket must be Pending to be reviewed')).toBe(true)
  })
})
