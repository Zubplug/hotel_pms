import { NextResponse } from 'next/server';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: unknown;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data } satisfies ApiSuccess<T>, { status });
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: unknown
) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details ? { details } : {}) } } satisfies ApiError,
    { status }
  );
}

export function paginatedResponse<T>(
  data: T[],
  meta: PaginatedMeta,
  status = 200
) {
  return NextResponse.json(
    { success: true, data, meta } satisfies ApiSuccess<T[]> & { meta: PaginatedMeta },
    { status }
  );
}
