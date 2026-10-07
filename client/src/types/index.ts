export type Role = 'Operator' | 'Manager'

export type TicketStatus = 'Pending' | 'Sent' | 'In Progress' | 'Completed' | 'Approved'

export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent'

export type VariantType = 'solid' | 'aop'

export interface ColourVariant {
  id: string
  name: string
  type: VariantType
  pantone?: string
  referenceImagePath?: string
}

export interface PartnerReceipt {
  sentAt?: string
  acknowledgedAt?: string
  receiptStatus?: 'Pending' | 'Acknowledged' | 'Received' | 'Rejected'
}

export interface BasePhotos {
  front: string
  back?: string
  detail?: string
}

export interface Ticket {
  id: string
  photoId: string
  style: string
  productNumber: string
  basePhotos: BasePhotos
  colourVariants: ColourVariant[]
  priority: Priority
  partnerId: string
  status: TicketStatus
  createdBy: Role
  createdAt: string
  updatedAt: string
  partnerReceipt?: PartnerReceipt
  notes?: string
  lastRejectionReason?: string
}

export interface Partner {
  id: string
  name: string
}

export interface ApprovedPhoto {
  id: string
  ticketId: string
  approvedBy: Role
  approvedAt: string
}
