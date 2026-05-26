import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { corsOptionsResponse } from '@/lib/cors';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/response';

// OPTIONS /api/merged-bills/[id]/bills - Handle CORS preflight
export async function OPTIONS() {
  return corsOptionsResponse();
}

// POST /api/merged-bills/[id]/bills - Thêm 1 bill vào merged group đã có
export async function POST(
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
      return errorResponse('ID merged bill không hợp lệ', 400);
    }

    const body = await request.json();
    const { billId } = body;
    if (!billId || typeof billId !== 'number') {
      return errorResponse('billId không hợp lệ', 400);
    }

    // Verify merged bill belongs to user
    const mergedBill = await prisma.mergedBill.findFirst({
      where: { id: mergedBillId, userId: tokenUser.userId },
    });
    if (!mergedBill) {
      return notFoundResponse('Merged bill không tồn tại');
    }

    // Verify bill exists, belongs to user, and is NOT already merged
    const bill = await prisma.bill.findFirst({
      where: { id: billId, userId: tokenUser.userId },
    });
    if (!bill) {
      return notFoundResponse('Bill không tồn tại');
    }
    if (bill.mergedBillId !== null) {
      return errorResponse('Bill này đã được gộp rồi', 400);
    }
    // Verify same customer as merged bill
    if (bill.customerId !== mergedBill.customerId) {
      return errorResponse('Bill không cùng khách hàng với nhóm gộp', 400);
    }

    // Update bill → point to merged group
    await prisma.bill.update({
      where: { id: billId },
      data: { mergedBillId },
    });

    // Recalculate merged bill totals
    const allChildBills = await prisma.bill.findMany({
      where: { mergedBillId },
      select: { totalAmount: true, totalFeeThu: true, totalTienAm: true },
    });
    const totalAmount = allChildBills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const totalFeeThu = allChildBills.reduce((sum, b) => sum + Number(b.totalFeeThu), 0);
    const totalTienAm = allChildBills.reduce((sum, b) => sum + Number(b.totalTienAm), 0);

    // Update timestamp to latest
    const latestChild = await prisma.bill.findFirst({
      where: { mergedBillId },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });

    await prisma.mergedBill.update({
      where: { id: mergedBillId },
      data: { totalAmount, totalFeeThu, totalTienAm, timestamp: latestChild?.timestamp ?? mergedBill.timestamp },
    });

    return successResponse({ message: 'Đã thêm bill vào nhóm gộp' }, 201);
  } catch (error) {
    console.error('Add bill to merged error:', error);
    return errorResponse('Internal server error', 500);
  }
}
