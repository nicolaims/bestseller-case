import { describe, expect, it } from 'vitest'
import { getTicketOwnership } from '../ticketOwnership'
import type { ColourVariant, TicketStatus } from '../../types'

function makeVariant(decision: ColourVariant['decision']): ColourVariant {
  return { id: 'v1', name: 'Granita', type: 'solid', pantone: 'Granita', decision }
}

function makeTicket(status: TicketStatus, overrides: Partial<Parameters<typeof getTicketOwnership>[0]> = {}) {
  return {
    status,
    colourVariants: [makeVariant('pending')],
    ...overrides,
  }
}

describe('getTicketOwnership', () => {
  it('is with the Operator and ready to send when Pending', () => {
    expect(getTicketOwnership(makeTicket('Pending'))).toEqual({
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

  it('is with the Manager when Completed and reports the decided/total count', () => {
    expect(
      getTicketOwnership(
        makeTicket('Completed', { colourVariants: [makeVariant('approved'), makeVariant('pending')] }),
      ),
    ).toEqual({
      owner: 'Manager',
      nextStepLabel: 'Awaiting manager review (1/2 colours decided)',
    })
  })

  it('has no owner when Approved', () => {
    expect(getTicketOwnership(makeTicket('Approved'))).toEqual({
      owner: null,
      nextStepLabel: 'Approved — no action needed',
    })
  })

  it('is back with the Operator when Rejected', () => {
    expect(getTicketOwnership(makeTicket('Rejected'))).toEqual({
      owner: 'Operator',
      nextStepLabel: 'Needs requeue before work can continue',
    })
  })
})
