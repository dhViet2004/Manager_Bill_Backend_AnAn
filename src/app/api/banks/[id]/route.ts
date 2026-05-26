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

// OPTIONS /api/banks/[id] - Handle CORS preflight
export async function OPTIONS() {
  return corsOptionsResponse();
}

// PUT /api/banks/[id] - Cập nhật ngân hàng
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
    const bankId = parseInt(id, 10);

    if (isNaN(bankId)) {
      return errorResponse('Invalid bank ID', 400);
    }

    const body = await request.json();
    const { name, shortName, code } = body;

    // Check if bank exists and belongs to user
    const existingBank = await prisma.bank.findFirst({
      where: {
        id: bankId,
        userId: tokenUser.userId,
      },
    });

    if (!existingBank) {
      return notFoundResponse('Bank not found');
    }

    // Check if new name conflicts with another bank
    if (name && name.trim() !== existingBank.name) {
      const conflictingBank = await prisma.bank.findFirst({
        where: {
          userId: tokenUser.userId,
          name: name.trim(),
          id: { not: bankId },
        },
      });

      if (conflictingBank) {
        return errorResponse('Ngân hàng đã tồn tại', 400);
      }
    }

    const bank = await prisma.bank.update({
      where: { id: bankId },
      data: {
        name: name?.trim() || existingBank.name,
        shortName: shortName?.trim() || null,
        code: code?.trim() || null,
      },
    });

    const response = {
      id: bank.id,
      name: bank.name,
      shortName: bank.shortName || undefined,
      code: bank.code || undefined,
      createdAt: bank.createdAt,
      updatedAt: bank.updatedAt,
    };

    return successResponse(response);
  } catch (error) {
    console.error('Update bank error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// DELETE /api/banks/[id] - Xóa ngân hàng
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
    const bankId = parseInt(id, 10);

    if (isNaN(bankId)) {
      return errorResponse('Invalid bank ID', 400);
    }

    // Check if bank exists and belongs to user
    const existingBank = await prisma.bank.findFirst({
      where: {
        id: bankId,
        userId: tokenUser.userId,
      },
    });

    if (!existingBank) {
      return notFoundResponse('Bank not found');
    }

    await prisma.bank.delete({
      where: { id: bankId },
    });

    return successResponse({ message: 'Bank deleted successfully' });
  } catch (error) {
    console.error('Delete bank error:', error);
    return errorResponse('Internal server error', 500);
  }
}
