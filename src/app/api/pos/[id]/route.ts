import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { corsOptionsResponse } from '@/lib/cors';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
} from '@/lib/response';

// OPTIONS /api/pos/[id] - Handle CORS preflight
export async function OPTIONS() {
  return corsOptionsResponse();
}

// PUT /api/pos/[id] - Cập nhật máy POS
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const posId = parseInt(id, 10);

    if (isNaN(posId)) {
      return errorResponse('Invalid POS ID', 400);
    }

    const body = await request.json();
    const { name, code, feePercent, note, isActive } = body;

    // Check if POS exists and belongs to user
    const existingPOS = await prisma.pOSMachine.findFirst({
      where: {
        id: posId,
        userId: tokenUser.userId,
      },
    });

    if (!existingPOS) {
      return notFoundResponse('POS machine not found');
    }

    // Check if new name conflicts with another POS
    if (name && name.trim() !== existingPOS.name) {
      const conflictingPOS = await prisma.pOSMachine.findFirst({
        where: {
          userId: tokenUser.userId,
          name: name.trim(),
          id: { not: posId },
        },
      });

      if (conflictingPOS) {
        return errorResponse('Máy POS đã tồn tại', 400);
      }
    }

    const posMachine = await prisma.pOSMachine.update({
      where: { id: posId },
      data: {
        name: name?.trim() || existingPOS.name,
        code: code?.trim() || null,
        feePercent: feePercent ?? existingPOS.feePercent,
        note: note?.trim() || null,
        isActive: isActive ?? existingPOS.isActive,
      },
    });

    const response = {
      id: posMachine.id,
      name: posMachine.name,
      code: posMachine.code || undefined,
      feePercent: posMachine.feePercent,
      note: posMachine.note || undefined,
      isActive: posMachine.isActive,
      createdAt: posMachine.createdAt,
      updatedAt: posMachine.updatedAt,
    };

    return successResponse(response);
  } catch (error) {
    console.error('Update POS machine error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// DELETE /api/pos/[id] - Xóa máy POS
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const posId = parseInt(id, 10);

    if (isNaN(posId)) {
      return errorResponse('Invalid POS ID', 400);
    }

    // Check if POS exists and belongs to user
    const existingPOS = await prisma.pOSMachine.findFirst({
      where: {
        id: posId,
        userId: tokenUser.userId,
      },
    });

    if (!existingPOS) {
      return notFoundResponse('POS machine not found');
    }

    await prisma.pOSMachine.delete({
      where: { id: posId },
    });

    return successResponse({ message: 'POS machine deleted successfully' });
  } catch (error) {
    console.error('Delete POS machine error:', error);
    return errorResponse('Internal server error', 500);
  }
}
