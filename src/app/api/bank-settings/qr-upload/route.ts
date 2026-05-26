import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { corsOptionsResponse } from '@/lib/cors';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/response';

// OPTIONS /api/bank-settings/qr-upload - Handle CORS preflight
export async function OPTIONS() {
  return corsOptionsResponse();
}

// POST /api/bank-settings/qr-upload - Upload QR image
export async function POST(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    // Check if request is multipart form data
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return errorResponse('Invalid content type. Expected multipart/form-data', 400);
    }

    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return errorResponse('No image file provided', 400);
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return errorResponse('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed', 400);
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return errorResponse('File size exceeds 5MB limit', 400);
    }

    // Convert to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUri = `data:${file.type};base64,${base64}`;

    return successResponse({
      qrImage: dataUri,
    });
  } catch (error) {
    console.error('QR upload error:', error);
    return errorResponse('Internal server error', 500);
  }
}
