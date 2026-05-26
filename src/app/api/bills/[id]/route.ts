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
        bankName: row.bankName || undefined,
        paymentType: row.paymentType || undefined,
        paymentMethod: row.paymentMethod || undefined,
        collectionHistory: row.collectionHistory.map(h => ({
          id: h.id,
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

    const { customerId, serviceType, note, isCollected, paymentType, paymentMethod, rows, collectionEntries } = result.data;
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
            bankName: row.bankName || null,
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
        bankName: row.bankName || undefined,
        paymentType: row.paymentType || undefined,
        paymentMethod: row.paymentMethod || undefined,
        collectionHistory: row.collectionHistory.map(h => ({
          id: h.id,
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
