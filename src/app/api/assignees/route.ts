import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { AssigneeSchema } from '@/lib/validators';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/response';

// GET /api/assignees - Lấy danh sách người phụ trách
export async function GET(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const assignees = await prisma.assignee.findMany({
      where: { userId: tokenUser.userId },
      orderBy: { name: 'asc' },
    });

    const transformed = assignees.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || undefined,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return successResponse({ assignees: transformed });
  } catch (error) {
    console.error('Get assignees error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// POST /api/assignees - Tạo người phụ trách mới
export async function POST(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const result = AssigneeSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(result.error.errors[0].message, 400);
    }

    const { name, phone, isActive } = result.data;

    // Check if assignee with same name already exists for this user
    const existing = await prisma.assignee.findFirst({
      where: {
        userId: tokenUser.userId,
        name,
      },
    });

    if (existing) {
      return errorResponse('Người phụ trách đã tồn tại', 400);
    }

    const assignee = await prisma.assignee.create({
      data: {
        userId: tokenUser.userId,
        name,
        phone: phone || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    const response = {
      id: assignee.id,
      name: assignee.name,
      phone: assignee.phone || undefined,
      isActive: assignee.isActive,
      createdAt: assignee.createdAt,
      updatedAt: assignee.updatedAt,
    };

    return successResponse(response, 201);
  } catch (error) {
    console.error('Create assignee error:', error);
    return errorResponse('Internal server error', 500);
  }
}
