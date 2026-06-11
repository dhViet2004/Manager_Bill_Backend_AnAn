import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '@/lib/response';

export const dynamic = 'force-dynamic';

// GET /api/bills/uncollected/count - Đếm số bill chưa thu tiền
export async function GET(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const count = await prisma.bill.count({
      where: {
        userId: tokenUser.userId,
        isCollected: false,
      },
    });

    return successResponse({ count });
  } catch (error) {
    console.error('Get uncollected count error:', error);
    return errorResponse('Internal server error', 500);
  }
}
