import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { CollaboratorSchema } from '@/lib/validators';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/response';

// GET /api/collaborators - Lấy danh sách cộng tác viên
export async function GET(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const collaborators = await prisma.collaborator.findMany({
      where: { userId: tokenUser.userId },
      orderBy: { name: 'asc' },
    });

    const transformed = collaborators.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || undefined,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return successResponse({ collaborators: transformed });
  } catch (error) {
    console.error('Get collaborators error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// POST /api/collaborators - Tạo cộng tác viên mới
export async function POST(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const result = CollaboratorSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(result.error.errors[0].message, 400);
    }

    const { name, phone, isActive } = result.data;

    // Check if collaborator with same name already exists for this user
    const existing = await prisma.collaborator.findFirst({
      where: {
        userId: tokenUser.userId,
        name,
      },
    });

    if (existing) {
      return errorResponse('Cộng tác viên đã tồn tại', 400);
    }

    const collaborator = await prisma.collaborator.create({
      data: {
        userId: tokenUser.userId,
        name,
        phone: phone || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    const response = {
      id: collaborator.id,
      name: collaborator.name,
      phone: collaborator.phone || undefined,
      isActive: collaborator.isActive,
      createdAt: collaborator.createdAt,
      updatedAt: collaborator.updatedAt,
    };

    return successResponse(response, 201);
  } catch (error) {
    console.error('Create collaborator error:', error);
    return errorResponse('Internal server error', 500);
  }
}
