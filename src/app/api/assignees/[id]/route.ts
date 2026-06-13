import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { AssigneeSchema } from '@/lib/validators';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/response';

interface RouteContext {
  params: {
    id: string;
  };
}

// PUT /api/assignees/[id] - Cập nhật người phụ trách
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return errorResponse('ID người phụ trách không hợp lệ', 400);
    }

    const body = await request.json();
    const result = AssigneeSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(result.error.errors[0].message, 400);
    }

    // Check ownership
    const existing = await prisma.assignee.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== tokenUser.userId) {
      return errorResponse('Không tìm thấy người phụ trách', 404);
    }

    const { name, phone, isActive } = result.data;

    // Check name duplicate
    if (name !== existing.name) {
      const duplicate = await prisma.assignee.findFirst({
        where: {
          userId: tokenUser.userId,
          name,
          id: { not: id },
        },
      });

      if (duplicate) {
        return errorResponse('Người phụ trách này đã tồn tại', 400);
      }
    }

    const assignee = await prisma.assignee.update({
      where: { id },
      data: {
        name,
        phone: phone || null,
        isActive: isActive !== undefined ? isActive : existing.isActive,
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

    return successResponse(response);
  } catch (error) {
    console.error('Update assignee error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// DELETE /api/assignees/[id] - Xóa người phụ trách
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return errorResponse('ID người phụ trách không hợp lệ', 400);
    }

    const existing = await prisma.assignee.findUnique({
      where: { id },
      include: {
        _count: {
          select: { bills: true }
        }
      }
    });

    if (!existing || existing.userId !== tokenUser.userId) {
      return errorResponse('Không tìm thấy người phụ trách', 404);
    }

    if (existing._count.bills > 0) {
      return errorResponse('Không thể xóa người phụ trách đã có giao dịch. Hãy vô hiệu hóa (deactivate) thay vì xóa.', 400);
    }

    await prisma.assignee.delete({
      where: { id },
    });

    return successResponse({ message: 'Đã xóa người phụ trách' });
  } catch (error) {
    console.error('Delete assignee error:', error);
    return errorResponse('Internal server error', 500);
  }
}
