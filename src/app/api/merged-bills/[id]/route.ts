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

// OPTIONS /api/merged-bills/[id] - Handle CORS preflight
export async function OPTIONS() {
  return corsOptionsResponse();
}

// PATCH /api/merged-bills/[id] - Cập nhật merged bill
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const mergedBillId = parseInt(id, 10);

    if (isNaN(mergedBillId)) {
      return errorResponse('ID không hợp lệ', 400);
    }

    const mergedBill = await prisma.mergedBill.findFirst({
      where: {
        id: mergedBillId,
        userId: tokenUser.userId,
      },
    });

    if (!mergedBill) {
      return notFoundResponse('Merged bill không tồn tại');
    }

    const body = await request.json();
    const { isCollected } = body;

    const updateData: Record<string, unknown> = {};
    if (typeof isCollected === 'boolean') {
      updateData.isCollected = isCollected;
    }

    const updated = await prisma.mergedBill.update({
      where: { id: mergedBillId },
      data: updateData,
    });

    return successResponse({
      id: updated.id,
      isCollected: updated.isCollected,
    });
  } catch (error) {
    console.error('Update merged bill error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// DELETE /api/merged-bills/[id] - Tách bill (unmerge)
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
    const mergedBillId = parseInt(id, 10);

    if (isNaN(mergedBillId)) {
      return errorResponse('ID không hợp lệ', 400);
    }

    // Find the merged bill
    const mergedBill = await prisma.mergedBill.findFirst({
      where: {
        id: mergedBillId,
        userId: tokenUser.userId,
      },
    });

    if (!mergedBill) {
      return notFoundResponse('Merged bill không tồn tại');
    }

    // Clear mergedBillId on all child bills (onDelete: SetNull in schema)
    // We also manually update to ensure it's cleared
    await prisma.bill.updateMany({
      where: { mergedBillId: mergedBillId },
      data: { mergedBillId: null },
    });

    // Delete the merged bill
    await prisma.mergedBill.delete({
      where: { id: mergedBillId },
    });

    return successResponse({ message: 'Tách bill thành công' });
  } catch (error) {
    console.error('Unmerge bill error:', error);
    return errorResponse('Internal server error', 500);
  }
}
