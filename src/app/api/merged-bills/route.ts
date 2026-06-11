import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { MergeBillsSchema } from '@/lib/validators-merged-bill';
import { DbToServiceType, ServiceType } from '@/types';
import { corsOptionsResponse } from '@/lib/cors';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '@/lib/response';

// OPTIONS /api/merged-bills - Handle CORS preflight
export async function OPTIONS() {
  return corsOptionsResponse();
}

// GET /api/merged-bills - Lấy danh sách merged bills
export async function GET(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const mergedBills = await prisma.mergedBill.findMany({
      where: { userId: tokenUser.userId },
      include: {
        customer: true,
        bills: {
          include: {
            customer: true,
            rows: {
              select: {
                id: true,
                rowUuid: true,
                amount: true,
                swipedAmount: true,
                feeGocPercent: true,
                feeThuPercent: true,
                rowNote: true,
                bankId: true,
                bankName: true,
                paymentType: true,
                paymentMethod: true,
                collectionHistory: {
                  orderBy: { timestamp: 'asc' },
                  select: { id: true, amount: true, timestamp: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const transformed = mergedBills.map((mb) => ({
      id: mb.id,
      userId: mb.userId,
      customerId: mb.customerId,
      customerName: mb.customer?.name || 'Khách lẻ',
      customer: mb.customer ? {
        id: mb.customer.id,
        name: mb.customer.name,
        phone: mb.customer.phone || undefined,
        address: mb.customer.address || undefined,
        createdAt: mb.customer.createdAt,
        updatedAt: mb.customer.updatedAt,
      } : undefined,
      totalAmount: Number(mb.totalAmount),
      totalFeeThu: Number(mb.totalFeeThu),
      totalTienAm: Number(mb.totalTienAm),
      isCollected: mb.isCollected,
      timestamp: Number(mb.timestamp),
      createdAt: mb.createdAt,
      updatedAt: mb.updatedAt,
      bills: mb.bills.map((bill) => ({
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
        note: bill.note ?? undefined,
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
        })),
      })),
    }));

    return successResponse({ mergedBills: transformed });
  } catch (error) {
    console.error('Get merged bills error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// POST /api/merged-bills - Gộp nhiều bill lại
export async function POST(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const result = MergeBillsSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(result.error.errors[0].message, 400);
    }

    const { billIds, customerId } = result.data;

    // Verify customer exists and belongs to user
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        userId: tokenUser.userId,
      },
    });

    if (!customer) {
      return errorResponse('Khách hàng không tồn tại', 400);
    }

    // Find all bills
    const bills = await prisma.bill.findMany({
      where: {
        id: { in: billIds },
        userId: tokenUser.userId,
      },
    });

    // Validate: all bills must exist
    if (bills.length !== billIds.length) {
      return errorResponse('Một số bill không tồn tại hoặc không thuộc về bạn', 400);
    }

    // Validate: no bill already merged
    const alreadyMerged = bills.filter((b) => b.mergedBillId !== null);
    if (alreadyMerged.length > 0) {
      return errorResponse(
        `Bill(s) ${alreadyMerged.map((b) => b.id).join(', ')} đã được gộp trước đó`,
        400
      );
    }

    // Merged bills must follow the customer already assigned to each bill.
    const hasDifferentCustomers = bills.some((b) => b.customerId !== bills[0].customerId);
    if (hasDifferentCustomers || bills[0].customerId !== customerId) {
      return errorResponse('Ch\u1ec9 c\u00f3 th\u1ec3 g\u1ed9p c\u00e1c bill c\u00f9ng kh\u00e1ch h\u00e0ng', 400);
    }

    // Calculate totals from all bills
    const totalAmount = bills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const totalFeeThu = bills.reduce((sum, b) => sum + Number(b.totalFeeThu), 0);
    const totalTienAm = bills.reduce((sum, b) => sum + Number(b.totalTienAm), 0);

    // Use the most recent timestamp among all bills
    const timestamps = bills.map((b) => Number(b.timestamp));
    const latestTimestamp = BigInt(Math.max(...timestamps));

    // Create MergedBill
    const mergedBill = await prisma.mergedBill.create({
      data: {
        userId: tokenUser.userId,
        customerId,
        totalAmount,
        totalFeeThu,
        totalTienAm,
        timestamp: latestTimestamp,
      },
    });

    // Update all bills to point to this mergedBill
    await prisma.bill.updateMany({
      where: { id: { in: billIds } },
      data: { mergedBillId: mergedBill.id },
    });

    // Fetch the created merged bill with bills included
    const created = await prisma.mergedBill.findUnique({
      where: { id: mergedBill.id },
      include: {
        customer: true,
        bills: {
          include: {
            customer: true,
            rows: {
              select: {
                id: true,
                rowUuid: true,
                amount: true,
                swipedAmount: true,
                feeGocPercent: true,
                feeThuPercent: true,
                rowNote: true,
                bankId: true,
                bankName: true,
                paymentType: true,
                paymentMethod: true,
                collectionHistory: {
                  orderBy: { timestamp: 'asc' },
                  select: { id: true, amount: true, timestamp: true },
                },
              },
            },
          },
        },
      },
    });

    const response = {
      id: created!.id,
      userId: created!.userId,
      customerId: created!.customerId,
      customerName: created!.customer?.name || 'Khách lẻ',
      customer: created!.customer ? {
        id: created!.customer.id,
        name: created!.customer.name,
        phone: created!.customer.phone || undefined,
        address: created!.customer.address || undefined,
        createdAt: created!.customer.createdAt,
        updatedAt: created!.customer.updatedAt,
      } : undefined,
      totalAmount: Number(created!.totalAmount),
      totalFeeThu: Number(created!.totalFeeThu),
      totalTienAm: Number(created!.totalTienAm),
      isCollected: created!.isCollected,
      timestamp: Number(created!.timestamp),
      createdAt: created!.createdAt,
      updatedAt: created!.updatedAt,
      bills: created!.bills.map((bill) => ({
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
        note: bill.note ?? undefined,
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
        })),
      })),
    };

    return successResponse(response, 201);
  } catch (error) {
    console.error('Merge bills error:', error);
    return errorResponse('Internal server error', 500);
  }
}
