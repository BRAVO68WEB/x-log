export type UserRole = "admin" | "author" | "reader";

export type PostVisibility = "public" | "unlisted" | "private";

export type DeliveryStatus = "pending" | "sent" | "failed" | "retrying";

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

