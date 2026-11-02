import type { Role, RequestStatus, ErrorCode, NotificationType } from '@/lib/constants';
export type { Role, RequestStatus, ErrorCode, NotificationType } from '@/lib/constants';
export interface FieldError { field: string; message: string }
export interface ApiErrorResponse { timestamp: string; status: number; code: ErrorCode; message: string; path: string; details: FieldError[] }
export interface PageResponse<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number }
export interface UserSummary { id: number; fullName: string; email: string; role: Role; flatNumber: string | null; active: boolean; createdAt?: string; updatedAt?: string }
export interface RegisterRequest { fullName: string; email: string; password: string; flatNumber: string }
export interface LoginRequest { email: string; password: string }
export interface RegisterResponse extends UserSummary {}
export interface LoginResponse { accessToken: string; tokenType: 'Bearer'; expiresAt: string; user: Omit<UserSummary, 'active' | 'createdAt' | 'updatedAt'> }
export interface ChangePasswordRequest { currentPassword: string; newPassword: string }
export interface ServiceDto { id: number; name: string; description: string | null; active: boolean }
export interface ServiceRequestDto { id: number; resident: { id: number; fullName: string }; flatNumber: string; service: { id: number; name: string }; description: string; requestDate: string; expectedCompletionDate: string; status: RequestStatus; adminRemarks: string | null; version: number; overdue: boolean; createdAt: string; updatedAt: string }
export interface RequestHistoryDto { fromStatus: RequestStatus | null; toStatus: RequestStatus; changedBy: { id: number; fullName: string }; remarks: string | null; createdAt: string }
export interface NotificationDto { id: number; requestId: number; type: NotificationType; message: string; read: boolean; createdAt: string; readAt: string | null }
export interface DashboardSummary { byStatus: Record<RequestStatus, number>; overdueCount: number; totalRequests: number; activeResidents: number; activeAdmins?: number }
export interface ContactQueryRequest { name: string; email: string; subject: string; message: string }
export interface ContactQueryDto { id: number; submittedById: number | null; name: string; email: string; subject: string; message: string; createdAt: string }
export interface ContactQueryCreated { id: number; createdAt: string }
export interface CreateUserRequest { fullName: string; email: string; password: string; role: Role; flatNumber?: string | null }
export interface UpdateUserRequest { fullName: string; email: string; flatNumber: string | null }
export interface SetActiveRequest { active: boolean }
export interface CreateServiceRequest { name: string; description?: string | null }
export interface UpdateServiceRequest extends CreateServiceRequest {}
export interface CreateServiceRequestBody { serviceId: number; description: string; expectedCompletionDate: string }
export interface UpdateServiceRequestBody { status?: RequestStatus; adminRemarks?: string }
export interface MarkNotificationReadRequest { read: true }
export interface RequestStatusHistoryItem extends RequestHistoryDto {}
export interface NotificationReadResponse { id: number; read: boolean; readAt: string | null }
export interface UnreadCountResponse { count: number }
export interface DashboardStatusCounts { PENDING: number; IN_PROGRESS: number; COMPLETED: number; REJECTED: number }
export interface HealthResponse { status: 'UP' | 'DOWN' }
export interface RequestQuery { status?: RequestStatus; overdue?: boolean; q?: string; page?: number; size?: number; sort?: string }
export interface UserQuery { role?: Role; active?: boolean; q?: string; page?: number; size?: number; sort?: string }
export interface ServiceQuery { q?: string; active?: boolean; page?: number; size?: number; sort?: string }
export interface NotificationQuery { unreadOnly?: boolean; page?: number; size?: number; sort?: string }
export interface ChangeRequestStatusResponse extends ServiceRequestDto {}
