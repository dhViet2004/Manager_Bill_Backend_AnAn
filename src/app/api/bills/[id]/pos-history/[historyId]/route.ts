import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { calculateBill } from '@/lib/calculations';
import { corsOptionsResponse } from '@/lib/cors';
import { DbToServiceType, ServiceType } from '@/types';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
} from '@/lib/response';

const UpdatePosHistorySchema = z.object({
  amount: z.number().positive(),
});

export async function OPTIONS() {
  return corsOptionsResponse();
}

async function getOwnedBill(billId: number, userId: number) {
  return prisma.bill.findFirst({
    where: { id: billId, userId },
    include: { customer: true },
  });
}

async function validatePosAmount(
  billRowId: number,
  type: string,
  nextAmount: number,
  currentHistoryId: number | null,
) {
  const row = await prisma.billRow.findUnique({
    where: { id: billRowId },
    include: { posHistory: true },
  });

  if (!row) {
    return 'Không tìm thấy dòng bill';
  }

  const depositedWithoutCurrent = row.posHistory
    .filter(history => history.type === 'DEPOSIT' && history.id !== currentHistoryId)
    .reduce((sum, history) => sum + Number(history.amount), 0);
  const withdrawnWithoutCurrent = row.posHistory
    .filter(history => history.type === 'WITHDRAW' && history.id !== currentHistoryId)
    .reduce((sum, history) => sum + Number(history.amount), 0);

  if (type === 'DEPOSIT') {
    const maxDeposit = Math.max(Number(row.amount) - depositedWithoutCurrent, 0);
    const minDeposit = Math.max(withdrawnWithoutCurrent - depositedWithoutCurrent, 0);

    if (nextAmount > maxDeposit) {
      return `Số tiền nạp không được vượt quá ${maxDeposit.toLocaleString('vi-VN')}đ`;
    }
    if (nextAmount < minDeposit) {
      return `Số tiền nạp không được nhỏ hơn ${minDeposit.toLocaleString('vi-VN')}đ vì đã có lịch sử rút`;
    }
  } else {
    const maxWithdraw = Math.max(depositedWithoutCurrent - withdrawnWithoutCurrent, 0);
    if (nextAmount > maxWithdraw) {
      return `Số tiền rút không được vượt quá ${maxWithdraw.toLocaleString('vi-VN')}đ`;
    }
  }

  return null;
}

async function recalculateBillFromPosHistory(billId: number, fallbackServiceType: ServiceType) {
  const rowsWithPosHistory = await prisma.billRow.findMany({
    where: { billId },
    include: { posHistory: true },
  });

  await Promise.all(rowsWithPosHistory.map(row => {
    const totalWithdrawn = row.posHistory
      .filter(history => history.type === 'WITHDRAW')
      .reduce((sum, history) => sum + Number(history.amount), 0);

    return prisma.billRow.update({
      where: { id: row.id },
      data: { swipedAmount: totalWithdrawn || null },
    });
  }));

  const recalculationRows = rowsWithPosHistory.map(row => {
    const totalWithdrawn = row.posHistory
      .filter(history => history.type === 'WITHDRAW')
      .reduce((sum, history) => sum + Number(history.amount), 0);

    return {
      id: row.rowUuid,
      amount: Number(row.amount),
      swipedAmount: totalWithdrawn,
      feeGocPercent: Number(row.feeGocPercent),
      feeThuPercent: Number(row.feeThuPercent),
      rowNote: row.rowNote || undefined,
      bankId: row.bankId || null,
      bankName: row.bankName || undefined,
      paymentType: row.paymentType || undefined,
      paymentMethod: row.paymentMethod || undefined,
    };
  });

  return calculateBill(recalculationRows, fallbackServiceType);
}

async function getBillResponse(billId: number) {
  const bill = await prisma.bill.findFirst({
    where: { id: billId },
    include: {
      customer: true,
      rows: {
        include: {
          collectionHistory: { orderBy: { timestamp: 'asc' } },
          posHistory: { orderBy: { timestamp: 'asc' } },
        },
      },
    },
  });

  if (!bill) return null;

  return {
    id: bill.id,
    timestamp: Number(bill.timestamp),
    customerId: bill.customerId,
    customer: bill.customer ? {
      id: bill.customer.id,
      name: bill.customer.name,
      phone: bill.customer.phone || undefined,
      address: bill.customer.address || undefined,
      createdAt: bill.customer.createdAt,
      updatedAt: bill.customer.updatedAt,
    } : undefined,
    serviceType: DbToServiceType[bill.serviceType] as ServiceType,
    note: bill.note,
    totalAmount: Number(bill.totalAmount),
    totalFeeThu: Number(bill.totalFeeThu),
    totalProfit: Number(bill.totalProfit),
    totalBankLai: Number(bill.totalBankLai),
    totalTienAm: Number(bill.totalTienAm),
    totalPhiPhaiTra: Number(bill.totalPhiPhaiTra),
    isCollected: bill.isCollected,
    mergedBillId: bill.mergedBillId,
    paymentType: bill.paymentType || undefined,
    paymentMethod: bill.paymentMethod || undefined,
    rows: bill.rows.map(row => ({
      id: row.id,
      rowUuid: row.rowUuid,
      amount: Number(row.amount),
      swipedAmount: row.swipedAmount ? Number(row.swipedAmount) : undefined,
      feeGocPercent: Number(row.feeGocPercent),
      feeThuPercent: Number(row.feeThuPercent),
      rowNote: row.rowNote || undefined,
      bankId: row.bankId || undefined,
      bankName: row.bankName || undefined,
      paymentType: row.paymentType || undefined,
      paymentMethod: row.paymentMethod || undefined,
      collectionHistory: row.collectionHistory.map(history => ({
        id: history.id,
        amount: Number(history.amount),
        timestamp: history.timestamp.toISOString(),
      })),
      posHistory: row.posHistory.map(history => ({
        id: history.id,
        type: history.type,
        amount: Number(history.amount),
        timestamp: history.timestamp.toISOString(),
      })),
    })),
  };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> },
) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) return unauthorizedResponse();

    const { id, historyId } = await params;
    const billId = parseInt(id, 10);
    const historyEntryId = parseInt(historyId, 10);
    if (Number.isNaN(billId) || Number.isNaN(historyEntryId)) {
      return errorResponse('Invalid bill ID or history ID', 400);
    }

    const existingBill = await getOwnedBill(billId, tokenUser.userId);
    if (!existingBill) return notFoundResponse('Bill not found');

    const body = await request.json();
    const result = UpdatePosHistorySchema.safeParse(body);
    if (!result.success) {
      return errorResponse('Số tiền không hợp lệ', 400);
    }

    const entry = await prisma.posHistoryEntry.findFirst({
      where: { id: historyEntryId, billRow: { billId } },
    });
    if (!entry) return notFoundResponse('POS history entry not found');

    const amount = Math.round(result.data.amount);
    const validationError = await validatePosAmount(entry.billRowId, entry.type, amount, entry.id);
    if (validationError) {
      return errorResponse(validationError, 400);
    }

    await prisma.posHistoryEntry.update({
      where: { id: historyEntryId },
      data: { amount },
    });

    const calculation = await recalculateBillFromPosHistory(
      billId,
      DbToServiceType[existingBill.serviceType] as ServiceType,
    );

    await prisma.bill.update({
      where: { id: billId },
      data: {
        totalAmount: calculation.totalAmount,
        totalFeeThu: calculation.totalFeeThu,
        totalProfit: calculation.totalProfit,
        totalBankLai: calculation.totalBankLai,
        totalTienAm: calculation.totalTienAm,
        totalPhiPhaiTra: calculation.totalPhiPhaiTra,
      },
    });

    const response = await getBillResponse(billId);
    return successResponse(response);
  } catch (error) {
    console.error('Update POS history error:', error);
    return errorResponse('Internal server error', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> },
) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) return unauthorizedResponse();

    const { id, historyId } = await params;
    const billId = parseInt(id, 10);
    const historyEntryId = parseInt(historyId, 10);
    if (Number.isNaN(billId) || Number.isNaN(historyEntryId)) {
      return errorResponse('Invalid bill ID or history ID', 400);
    }

    const existingBill = await getOwnedBill(billId, tokenUser.userId);
    if (!existingBill) return notFoundResponse('Bill not found');

    const entry = await prisma.posHistoryEntry.findFirst({
      where: { id: historyEntryId, billRow: { billId } },
    });
    if (!entry) return notFoundResponse('POS history entry not found');

    if (entry.type === 'DEPOSIT') {
      const validationError = await validatePosAmount(entry.billRowId, entry.type, 0, entry.id);
      if (validationError) {
        return errorResponse('Không thể xóa lịch sử nạp này vì đã có lịch sử rút phụ thuộc', 400);
      }
    }

    await prisma.posHistoryEntry.delete({
      where: { id: historyEntryId },
    });

    const calculation = await recalculateBillFromPosHistory(
      billId,
      DbToServiceType[existingBill.serviceType] as ServiceType,
    );

    await prisma.bill.update({
      where: { id: billId },
      data: {
        totalAmount: calculation.totalAmount,
        totalFeeThu: calculation.totalFeeThu,
        totalProfit: calculation.totalProfit,
        totalBankLai: calculation.totalBankLai,
        totalTienAm: calculation.totalTienAm,
        totalPhiPhaiTra: calculation.totalPhiPhaiTra,
      },
    });

    const response = await getBillResponse(billId);
    return successResponse(response);
  } catch (error) {
    console.error('Delete POS history error:', error);
    return errorResponse('Internal server error', 500);
  }
}
