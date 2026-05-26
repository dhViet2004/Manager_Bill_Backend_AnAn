import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { corsOptionsResponse } from '@/lib/cors';
import { DbToServiceType, ServiceType } from '@/types';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
} from '@/lib/response';

// OPTIONS /api/bills/[id]/rows/[rowId] - Handle CORS preflight
export async function OPTIONS() {
  return corsOptionsResponse();
}

// PUT /api/bills/[id]/rows/[rowId] - Cập nhật ghi chú của một row cụ thể
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const { id, rowId } = await params;
    const billId = parseInt(id, 10);

    if (isNaN(billId)) {
      return errorResponse('Invalid bill ID', 400);
    }

    // Check if bill exists and belongs to user
    const existingBill = await prisma.bill.findFirst({
      where: {
        id: billId,
        userId: tokenUser.userId,
      },
      include: {
        customer: true,
      },
    });

    if (!existingBill) {
      return notFoundResponse('Bill not found');
    }

    // Tìm row cần cập nhật (theo rowUuid hoặc id)
    const existingRow = await prisma.billRow.findFirst({
      where: {
        billId,
        OR: [
          { id: parseInt(rowId, 10) },
          { rowUuid: rowId },
        ],
      },
    });

    if (!existingRow) {
      return notFoundResponse('Row not found');
    }

    const body = await request.json();
    const { rowNote } = body;

    // Cập nhật chỉ rowNote của row
    const row = await prisma.billRow.update({
      where: { id: existingRow.id },
      data: {
        rowNote: rowNote || null,
      },
    });

    // Lấy lại bill với rows đã cập nhật
    const bill = await prisma.bill.findFirst({
      where: { id: billId },
      include: {
        customer: true,
        rows: true,
      },
    });

    const response = {
      id: bill!.id,
      timestamp: Number(bill!.timestamp),
      customerId: bill!.customerId,
      customer: bill!.customer ? {
        id: bill!.customer.id,
        name: bill!.customer.name,
        phone: bill!.customer.phone || undefined,
        address: bill!.customer.address || undefined,
        createdAt: bill!.customer.createdAt,
        updatedAt: bill!.customer.updatedAt,
      } : undefined,
      serviceType: DbToServiceType[bill!.serviceType] as ServiceType,
      note: bill!.note,
      totalAmount: Number(bill!.totalAmount),
      totalFeeThu: Number(bill!.totalFeeThu),
      totalProfit: Number(bill!.totalProfit),
      totalBankLai: Number(bill!.totalBankLai),
      totalTienAm: Number(bill!.totalTienAm),
      totalPhiPhaiTra: Number(bill!.totalPhiPhaiTra),
      rows: bill!.rows.map((r) => ({
        id: r.id,
        rowUuid: r.rowUuid,
        amount: Number(r.amount),
        swipedAmount: r.swipedAmount ? Number(r.swipedAmount) : undefined,
        feeGocPercent: Number(r.feeGocPercent),
        feeThuPercent: Number(r.feeThuPercent),
        rowNote: r.rowNote || undefined,
      })),
    };

    return successResponse(response);
  } catch (error) {
    console.error('Update row note error:', error);
    return errorResponse('Internal server error', 500);
  }
}
