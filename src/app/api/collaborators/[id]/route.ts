import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { CollaboratorSchema } from '@/lib/validators';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/response';

interface RouteContext {
  params: {
    id: string;
  };
}

// PUT /api/collaborators/[id] - Cập nhật cộng tác viên
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return errorResponse('ID cộng tác viên không hợp lệ', 400);
    }

    const body = await request.json();
    const result = CollaboratorSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(result.error.errors[0].message, 400);
    }

    // Check ownership
    const existing = await prisma.collaborator.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== tokenUser.userId) {
      return errorResponse('Không tìm thấy cộng tác viên', 404);
    }

    const { name, phone, isActive } = result.data;

    // Check name duplicate
    if (name !== existing.name) {
      const duplicate = await prisma.collaborator.findFirst({
        where: {
          userId: tokenUser.userId,
          name,
          id: { not: id },
        },
      });

      if (duplicate) {
        return errorResponse('Cộng tác viên này đã tồn tại', 400);
      }
    }

    const collaborator = await prisma.collaborator.update({
      where: { id },
      data: {
        name,
        phone: phone || null,
        isActive: isActive !== undefined ? isActive : existing.isActive,
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

    return successResponse(response);
  } catch (error) {
    console.error('Update collaborator error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// DELETE /api/collaborators/[id] - Xóa cộng tác viên
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return errorResponse('ID cộng tác viên không hợp lệ', 400);
    }

    const existing = await prisma.collaborator.findUnique({
      where: { id },
      include: {
        _count: {
          select: { banks: true }
        }
      }
    });

    if (!existing || existing.userId !== tokenUser.userId) {
      return errorResponse('Không tìm thấy cộng tác viên', 404);
    }

    if (existing._count.banks > 0) {
      return errorResponse('Không thể xóa cộng tác viên đã có liên kết thẻ. Hãy vô hiệu hóa (deactivate) thay vì xóa.', 400);
    }

    await prisma.collaborator.delete({
      where: { id },
    });

    return successResponse({ message: 'Đã xóa cộng tác viên' });
  } catch (error) {
    console.error('Delete collaborator error:', error);
    return errorResponse('Internal server error', 500);
  }
}
