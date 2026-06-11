import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { UpdateBillSchema } from '@/lib/validators';
import { calculateBill } from '@/lib/calculations';
import { ServiceTypeToDb, DbToServiceType, ServiceType } from '@/types';
import { corsOptionsResponse } from '@/lib/cors';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
} from '@/lib/response';

const formatBankCardLabel = (bank: {
  name: string;
  lastFourDigits: string | null;
  cardHolderName: string | null;
  collaboratorName: string | null;
}) => [
  bank.name,
  bank.lastFourDigits ? `**** ${bank.lastFourDigits}` : '',
  bank.cardHolderName ? `- ${bank.cardHolderName}` : '',
  bank.collaboratorName ? `(${bank.collaboratorName})` : '',
].filter(Boolean).join(' ');

async function getBankLabelMap(rows: { bankId?: number | null }[], userId: number) {
  const bankIds = Array.from(new Set(
    rows.map(row => row.bankId).filter((bankId): bankId is number => typeof bankId === 'number')
  ));

  if (bankIds.length === 0) {
    return new Map<number, string>();
  }

  const banks = await prisma.bank.findMany({
    where: { id: { in: bankIds }, userId },
    select: {
      id: true,
      name: true,
      lastFourDigits: true,
      cardHolderName: true,
      collaboratorName: true,
    },
  });

  if (banks.length !== bankIds.length) {
    throw new Error('INVALID_BANK_CARD');
  }

  return new Map(banks.map(bank => [bank.id, formatBankCardLabel(bank)]));
}

// OPTIONS /api/bills/[id] - Handle CORS preflight
export async function OPTIONS() {
  return corsOptionsResponse();
}

// GET /api/bills/[id] - Lấy chi tiết bill
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const billId = parseInt(id, 10);

    if (isNaN(billId)) {
      return errorResponse('Invalid bill ID', 400);
    }

    const bill = await prisma.bill.findFirst({
      where: {
        id: billId,
        userId: tokenUser.userId,
      },
      include: {
        customer: true,
        rows: {
          include: {
            collectionHistory: {
              orderBy: { timestamp: 'asc' },
            },
            posHistory: {
              orderBy: { timestamp: 'asc' },
            },
          },
        },
      },
    });

    if (!bill) {
      return notFoundResponse('Bill not found');
    }

    const response = {
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
      rows: bill.rows.map((row) => ({
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
        collectionHistory: row.collectionHistory.map(h => ({
          id: h.id,
          amount: Number(h.amount),
          timestamp: h.timestamp.toISOString(),
        })),
        posHistory: row.posHistory.map(h => ({
          id: h.id,
          type: h.type,
          amount: Number(h.amount),
          timestamp: h.timestamp.toISOString(),
        })),
      })),
    };

    return successResponse(response);
  } catch (error) {
    console.error('Get bill error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// PUT /api/bills/[id] - Cập nhật bill
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
    });

    if (!existingBill) {
      return notFoundResponse('Bill not found');
    }

    const body = await request.json();
    console.log('[updateBill] raw body:', JSON.stringify(body));
    const result = UpdateBillSchema.safeParse(body);
    if (!result.success) {
      console.error('[updateBill] validation error:', JSON.stringify(result.error.format(), null, 2));
      return errorResponse(`Validation error: ${result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`, 400);
    }

    const { customerId, serviceType, note, isCollected, paymentType, paymentMethod, rows, collectionEntries, posEntries } = result.data;
    console.log('[updateBill] parsed paymentType:', paymentType, 'paymentMethod:', paymentMethod);
    if (rows) {
      console.log('[updateBill] rows[0] paymentType:', rows[0]?.paymentType, 'paymentMethod:', rows[0]?.paymentMethod);
    }

    // Verify new customer if changing
    if (customerId && customerId !== existingBill.customerId) {
      const newCustomer = await prisma.customer.findFirst({
        where: {
          id: customerId,
          userId: tokenUser.userId,
        },
      });
      if (!newCustomer) {
        return errorResponse('Khách hàng không tồn tại', 400);
      }
    }

    const updateData: Record<string, unknown> = {
      customerId: customerId || existingBill.customerId,
      serviceType: serviceType
        ? ServiceTypeToDb[serviceType as ServiceType]
        : existingBill.serviceType,
      note: note !== undefined ? note : existingBill.note,
      isCollected: isCollected !== undefined ? isCollected : existingBill.isCollected,
      paymentType: paymentType !== undefined ? paymentType : existingBill.paymentType,
      paymentMethod: paymentMethod !== undefined ? paymentMethod : existingBill.paymentMethod,
    };

    // Full row update with recalculation
    if (rows) {
      const calculation = calculateBill(rows, serviceType as ServiceType || DbToServiceType[existingBill.serviceType] as ServiceType);
      let bankLabelById: Map<number, string>;
      try {
        bankLabelById = await getBankLabelMap(rows, tokenUser.userId);
      } catch (error) {
        if (error instanceof Error && error.message === 'INVALID_BANK_CARD') {
          return errorResponse('Tháº» khÃ´ng tá»“n táº¡i hoáº·c khÃ´ng thuá»™c tÃ i khoáº£n nÃ y', 400);
        }
        throw error;
      }
      updateData.totalAmount = calculation.totalAmount;
      updateData.totalFeeThu = calculation.totalFeeThu;
      updateData.totalProfit = calculation.totalProfit;
      updateData.totalBankLai = calculation.totalBankLai;
      updateData.totalTienAm = calculation.totalTienAm;
      updateData.totalPhiPhaiTra = calculation.totalPhiPhaiTra;

      const existingRows = await prisma.billRow.findMany({ where: { billId } });
      const existingSwipedMap = new Map(existingRows.map(r => [r.rowUuid, Number(r.swipedAmount ?? 0)]));

      await prisma.billRow.deleteMany({ where: { billId } });

      const histEntries: { rowUuid: string; delta: number }[] = [];

      updateData.rows = {
        create: rows.map((row) => {
          const oldSwiped = existingSwipedMap.get(row.id) ?? 0;
          const newSwiped = row.swipedAmount ?? 0;
          if (newSwiped > oldSwiped) {
            histEntries.push({ rowUuid: row.id, delta: newSwiped - oldSwiped });
          }
          return {
            rowUuid: row.id,
            amount: row.amount,
            swipedAmount: row.swipedAmount || null,
            feeGocPercent: row.feeGocPercent,
            feeThuPercent: row.feeThuPercent,
            rowNote: row.rowNote || null,
            bankId: row.bankId || null,
            bankName: row.bankId ? bankLabelById.get(row.bankId) || null : row.bankName || null,
            paymentType: row.paymentType ?? null,
            paymentMethod: row.paymentMethod ?? null,
          };
        }),
      };

      if (histEntries.length > 0) {
        const createdRows = await prisma.billRow.findMany({
          where: { billId },
          select: { id: true, rowUuid: true },
        });
        const newRowIdMap = new Map(createdRows.map(r => [r.rowUuid, r.id]));
        const historyCreates = histEntries
          .filter(e => newRowIdMap.has(e.rowUuid))
          .map(e => ({ billRowId: newRowIdMap.get(e.rowUuid)!, amount: Math.round(e.delta) }));
        if (historyCreates.length > 0) {
          await prisma.collectionHistoryEntry.createMany({ data: historyCreates });
        }
      }
    }

    // Standalone collection entries (no row recalculation)
    if (collectionEntries && collectionEntries.length > 0) {
      const existingRows = await prisma.billRow.findMany({ where: { billId } });
      const histCreates: { billRowId: number; amount: number }[] = [];

      for (const entry of collectionEntries) {
        const row = existingRows.find(r => r.rowUuid === entry.rowId);
        if (!row) continue;
        histCreates.push({ billRowId: row.id, amount: Math.round(entry.amount) });
      }

      if (histCreates.length > 0) {
        await prisma.collectionHistoryEntry.createMany({ data: histCreates });
      }
    }

    if (posEntries && posEntries.length > 0) {
      const existingRows = await prisma.billRow.findMany({
        where: { billId },
        include: { posHistory: true },
      });
      const posCreates: { billRowId: number; type: string; amount: number }[] = [];
      const rowTotals = new Map(existingRows.map(row => {
        const deposited = row.posHistory
          .filter(history => history.type === 'DEPOSIT')
          .reduce((sum, history) => sum + Number(history.amount), 0);
        const withdrawn = row.posHistory
          .filter(history => history.type === 'WITHDRAW')
          .reduce((sum, history) => sum + Number(history.amount), 0);

        return [row.rowUuid, {
          amount: Number(row.amount),
          deposited,
          withdrawn,
        }];
      }));

      for (const entry of posEntries) {
        const row = existingRows.find(r => r.rowUuid === entry.rowId);
        if (!row) continue;
        const totals = rowTotals.get(entry.rowId);
        if (!totals) continue;
        const amount = Math.round(entry.amount);

        if (entry.type === 'DEPOSIT') {
          const maxDeposit = Math.max(totals.amount - totals.deposited, 0);
          if (amount > maxDeposit) {
            return errorResponse(`Số tiền nạp vượt quá số tiền có thể nạp của dòng ${row.bankName || row.rowUuid}`, 400);
          }
          totals.deposited += amount;
        } else {
          const maxWithdraw = Math.max(totals.deposited - totals.withdrawn, 0);
          if (amount > maxWithdraw) {
            return errorResponse(`Số tiền rút vượt quá số tiền có thể rút của dòng ${row.bankName || row.rowUuid}`, 400);
          }
          totals.withdrawn += amount;
        }

        posCreates.push({
          billRowId: row.id,
          type: entry.type,
          amount,
        });
      }

      if (posCreates.length > 0) {
        await prisma.posHistoryEntry.createMany({ data: posCreates });
      }

      if (posEntries.some(entry => entry.type === 'WITHDRAW')) {
        const rowsWithPosHistory = await prisma.billRow.findMany({
          where: { billId },
          include: { posHistory: true },
        });

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

        await Promise.all(rowsWithPosHistory.map(row => {
          const totalWithdrawn = row.posHistory
            .filter(history => history.type === 'WITHDRAW')
            .reduce((sum, history) => sum + Number(history.amount), 0);

          return prisma.billRow.update({
            where: { id: row.id },
            data: { swipedAmount: totalWithdrawn || null },
          });
        }));

        const targetServiceType = serviceType || DbToServiceType[existingBill.serviceType] as ServiceType;
        const calculation = calculateBill(recalculationRows, targetServiceType);
        updateData.totalAmount = calculation.totalAmount;
        updateData.totalFeeThu = calculation.totalFeeThu;
        updateData.totalProfit = calculation.totalProfit;
        updateData.totalBankLai = calculation.totalBankLai;
        updateData.totalTienAm = calculation.totalTienAm;
        updateData.totalPhiPhaiTra = calculation.totalPhiPhaiTra;
      }
    }

    const bill = await prisma.bill.update({
      where: { id: billId },
      data: updateData,
      include: {
        customer: true,
        rows: {
          include: {
            collectionHistory: {
              orderBy: { timestamp: 'asc' },
            },
            posHistory: {
              orderBy: { timestamp: 'asc' },
            },
          },
        },
      },
    });

    const response = {
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
      rows: bill.rows.map((row) => ({
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
        collectionHistory: row.collectionHistory.map(h => ({
          id: h.id,
          amount: Number(h.amount),
          timestamp: h.timestamp.toISOString(),
        })),
        posHistory: row.posHistory.map(h => ({
          id: h.id,
          type: h.type,
          amount: Number(h.amount),
          timestamp: h.timestamp.toISOString(),
        })),
      })),
    };

    return successResponse(response);
  } catch (error) {
    console.error('Update bill error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// DELETE /api/bills/[id] - Xóa bill
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
    });

    if (!existingBill) {
      return notFoundResponse('Bill not found');
    }

    // Delete bill (cascade will delete rows)
    await prisma.bill.delete({
      where: { id: billId },
    });

    return successResponse({ message: 'Bill deleted successfully' });
  } catch (error) {
    console.error('Delete bill error:', error);
    return errorResponse('Internal server error', 500);
  }
}
