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

// OPTIONS /api/bills/[id]/collection-history/[historyId] - Handle CORS preflight
export async function OPTIONS() {
  return corsOptionsResponse();
}

// DELETE /api/bills/[id]/collection-history/[historyId] - Xóa một entry lịch sử thu tiền
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> }
) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const { id, historyId } = await params;
    const billId = parseInt(id, 10);
    const historyEntryId = parseInt(historyId, 10);

    if (isNaN(billId) || isNaN(historyEntryId)) {
      return errorResponse('Invalid bill ID or history ID', 400);
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

    // Tìm entry cần xóa và verify nó thuộc về row của bill này
    const entry = await prisma.collectionHistoryEntry.findFirst({
      where: {
        id: historyEntryId,
        billRow: {
          billId: billId,
        },
      },
    });

    if (!entry) {
      return notFoundResponse('Collection history entry not found');
    }

    // Xóa entry
    await prisma.collectionHistoryEntry.delete({
      where: { id: historyEntryId },
    });

    // Lấy lại bill với collectionHistory đã cập nhật
    const bill = await prisma.bill.findFirst({
      where: { id: billId },
      include: {
        customer: true,
        rows: {
          include: {
            collectionHistory: {
              orderBy: { timestamp: 'asc' },
            },
          },
        },
      },
    });

    // Tính toán lại isCollected dựa trên tổng đã thu so với tổng nợ
    const totalCollected = bill!.rows.reduce((sum, row) =>
      sum + row.collectionHistory.reduce((hSum, h) => hSum + Number(h.amount), 0), 0
    );
    const totalDebt = Number(bill!.totalFeeThu) + Number(bill!.totalTienAm);
    const newIsCollected = totalCollected >= totalDebt;

    // Cập nhật isCollected trong database nếu cần
    if (bill!.isCollected !== newIsCollected) {
      await prisma.bill.update({
        where: { id: billId },
        data: { isCollected: newIsCollected },
      });
    }

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
      isCollected: newIsCollected,
      mergedBillId: bill!.mergedBillId,
      rows: bill!.rows.map((row) => ({
        id: row.id,
        rowUuid: row.rowUuid,
        amount: Number(row.amount),
        swipedAmount: row.swipedAmount ? Number(row.swipedAmount) : undefined,
        feeGocPercent: Number(row.feeGocPercent),
        feeThuPercent: Number(row.feeThuPercent),
        rowNote: row.rowNote || undefined,
        bankName: row.bankName || undefined,
        collectionHistory: row.collectionHistory.map((h) => ({
          id: h.id,
          amount: Number(h.amount),
          timestamp: h.timestamp.toISOString(),
        })),
      })),
    };

    return successResponse(response);
  } catch (error) {
    console.error('Delete collection history error:', error);
    return errorResponse('Internal server error', 500);
  }
}
