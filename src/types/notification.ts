export interface NotificationItem {
  id: number
  recipientUserName: string
  notificationType: string
  title: string
  content: string | null
  businessLineCode: string | null
  environmentCode: string | null
  readFlag: boolean
  readAt: string | null
  createdAt: string
}
