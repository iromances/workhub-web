import type { ApiResponse, PageResponse } from '@/types/http'
import type { NotificationItem } from '@/types/notification'

import http from './http'

export async function fetchNotifications(limit = 50): Promise<NotificationItem[]> {
  const response = await http.get<ApiResponse<PageResponse<NotificationItem>>>('/notifications', { params: { limit } })
  return response.data.data.items
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const response = await http.get<ApiResponse<{ count: number }>>('/notifications/unread-count')
  return response.data.data.count
}

export async function markNotificationRead(id: number): Promise<void> {
  await http.post<ApiResponse<void>>(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead(): Promise<void> {
  await http.post<ApiResponse<void>>('/notifications/read-all')
}
