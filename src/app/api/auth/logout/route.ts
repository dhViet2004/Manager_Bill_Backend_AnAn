import { NextRequest } from 'next/server';
import { clearTokenCookie, getCurrentUser } from '@/lib/auth';
import { messageResponse, unauthorizedResponse } from '@/lib/response';
import { corsOptionsResponse } from '@/lib/cors';

export async function OPTIONS() {
  return corsOptionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    // Verify token
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    // Clear cookie
    await clearTokenCookie();

    return messageResponse('Logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    return messageResponse('Logged out successfully');
  }
}
