import { NextResponse } from 'next/server';
import { ApiResponse } from '@/types';
import { CORS_HEADERS } from '@/lib/cors';

/**
 * Tạo response thành công
 */
export function successResponse<T>(data: T, status = 200): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  return NextResponse.json(response, { status, headers: CORS_HEADERS });
}

/**
 * Tạo response thất bại
 */
export function errorResponse(error: string, status = 400): NextResponse {
  const response: ApiResponse = {
    success: false,
    error,
  };
  return NextResponse.json(response, { status, headers: CORS_HEADERS });
}

/**
 * Tạo response message (cho các action như delete, logout)
 */
export function messageResponse(message: string, status = 200): NextResponse {
  const response: ApiResponse = {
    success: true,
    message,
  };
  return NextResponse.json(response, { status, headers: CORS_HEADERS });
}

/**
 * Tạo response 401 Unauthorized
 */
export function unauthorizedResponse(): NextResponse {
  return errorResponse('Unauthorized', 401);
}

/**
 * Tạo response 404 Not Found
 */
export function notFoundResponse(message = 'Resource not found'): NextResponse {
  return errorResponse(message, 404);
}

/**
 * Tạo response 500 Internal Server Error
 */
export function serverErrorResponse(error = 'Internal server error'): NextResponse {
  return errorResponse(error, 500);
}
