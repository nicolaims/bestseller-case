import type { ColourVariant, PartnerReceipt, TicketStatus } from '../types'

export type TicketOwner = 'Operator' | 'Manager' | 'Partner' | null

export interface TicketOwnership {
  owner: TicketOwner
  nextStepLabel: string
}

export function getTicketOwnership(ticket: {
  status: TicketStatus
  partnerReceipt?: PartnerReceipt
  colourVariants: ColourVariant[]
}): TicketOwnership {
  switch (ticket.status) {
    case 'Pending':
      return { owner: 'Operator', nextStepLabel: 'Ready to send to partner' }
    case 'Sent':
      if (ticket.partnerReceipt?.receiptStatus === 'Rejected') {
        return { owner: 'Operator', nextStepLabel: 'Partner rejected the receipt — force acknowledge or resend' }
      }
      return { owner: 'Partner', nextStepLabel: 'Awaiting partner acknowledgement' }
    case 'In Progress':
      return { owner: 'Partner', nextStepLabel: 'Partner producing colour samples' }
    case 'Completed': {
      const decided = ticket.colourVariants.filter((v) => v.decision !== 'pending').length
      const total = ticket.colourVariants.length
      return { owner: 'Manager', nextStepLabel: `Awaiting manager review (${decided}/${total} colours decided)` }
    }
    case 'Approved':
      return { owner: null, nextStepLabel: 'Approved — no action needed' }
    case 'Rejected':
      return { owner: 'Operator', nextStepLabel: 'Needs requeue before work can continue' }
  }
}
