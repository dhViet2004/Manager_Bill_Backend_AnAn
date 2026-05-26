import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, unauthorizedResponse } from '@/lib/response';
import { corsOptionsResponse } from '@/lib/cors';

export async function OPTIONS() {
  return corsOptionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    // Verify token
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: tokenUser.userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        photoUrl: true,
      },
    });

    if (!user) {
      return unauthorizedResponse();
    }

    return successResponse({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      photoURL: user.photoUrl,
    });
  } catch (error) {
    console.error('Get me error:', error);
    return unauthorizedResponse();
  }
}
