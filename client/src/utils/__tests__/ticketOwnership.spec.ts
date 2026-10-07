import { describe, expect, it } from 'vitest'
import { getTicketOwnership } from '../ticketOwnership'
import type { TicketStatus } from '../../types'

function makeTicket(status: TicketStatus, overrides: Partial<Parameters<typeof getTicketOwnership>[0]> = {}) {
  return {
    status,
    ...overrides,
  }
}

describe('getTicketOwnership', () => {
  it('is with the Manager, awaiting approval, when Pending with no prior rejection', () => {
    expect(getTicketOwnership(makeTicket('Pending'))).toEqual({
      owner: 'Manager',
      nextStepLabel: 'Awaiting manager approval',
    })
  })

  it('falls back to the Operator with the reason when Pending after a rejection', () => {
    expect(getTicketOwnership(makeTicket('Pending', { lastRejectionReason: 'Wrong tone' }))).toEqual({
      owner: 'Operator',
      nextStepLabel: 'Rejected by Manager: Wrong tone',
    })
  })

  it('is with the Operator, ready to send, when Approved', () => {
    expect(getTicketOwnership(makeTicket('Approved'))).toEqual({
      owner: 'Operator',
      nextStepLabel: 'Ready to send to partner',
    })
  })

  it('is with the Partner when Sent and awaiting acknowledgement', () => {
    expect(getTicketOwnership(makeTicket('Sent'))).toEqual({
      owner: 'Partner',
      nextStepLabel: 'Awaiting partner acknowledgement',
    })
  })

  it('falls back to the Operator when Sent but the partner rejected the receipt', () => {
    expect(
      getTicketOwnership(makeTicket('Sent', { partnerReceipt: { receiptStatus: 'Rejected' } })),
    ).toEqual({
      owner: 'Operator',
      nextStepLabel: 'Partner rejected the receipt — force acknowledge or resend',
    })
  })

  it('is with the Partner when In Progress', () => {
    expect(getTicketOwnership(makeTicket('In Progress'))).toEqual({
      owner: 'Partner',
      nextStepLabel: 'Partner producing colour samples',
    })
  })

  it('has no owner when Completed', () => {
    expect(getTicketOwnership(makeTicket('Completed'))).toEqual({
      owner: null,
      nextStepLabel: 'Done',
    })
  })
})
