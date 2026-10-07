import type { PartnerReceipt, TicketStatus } from '../types'

export type TicketOwner = 'Operator' | 'Manager' | 'Partner' | null

export interface TicketOwnership {
  owner: TicketOwner
  nextStepLabel: string
}

export function getTicketOwnership(ticket: {
  status: TicketStatus
  partnerReceipt?: PartnerReceipt
  lastRejectionReason?: string
}): TicketOwnership {
  switch (ticket.status) {
    case 'Pending':
      return ticket.lastRejectionReason
        ? { owner: 'Operator', nextStepLabel: `Rejected by Manager: ${ticket.lastRejectionReason}` }
        : { owner: 'Manager', nextStepLabel: 'Awaiting manager approval' }
    case 'Approved':
      return { owner: 'Operator', nextStepLabel: 'Ready to send to partner' }
    case 'Sent':
      if (ticket.partnerReceipt?.receiptStatus === 'Rejected') {
        return { owner: 'Operator', nextStepLabel: 'Partner rejected the receipt — force acknowledge or resend' }
      }
      return { owner: 'Partner', nextStepLabel: 'Awaiting partner acknowledgement' }
    case 'In Progress':
      return { owner: 'Partner', nextStepLabel: 'Partner producing colour samples' }
    case 'Completed':
      return { owner: null, nextStepLabel: 'Done' }
  }
}
