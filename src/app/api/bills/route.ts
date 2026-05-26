import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { CreateBillSchema, BillsQuerySchema } from '@/lib/validators';
import { calculateBill } from '@/lib/calculations';
import { ServiceTypeToDb, DbToServiceType, ServiceType, CustomerResponse } from '@/types';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '@/lib/response';

// GET /api/bills - Lấy danh sách bills
export async function GET(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const queryParams = {
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      customerId: searchParams.get('customerId') || undefined,
      serviceType: searchParams.get('serviceType') || undefined,
      isCollected: searchParams.get('isCollected') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    };

    const queryResult = BillsQuerySchema.safeParse(queryParams);
    if (!queryResult.success) {
      return errorResponse(queryResult.error.errors[0].message, 400);
    }

    const { startDate, endDate, customerId, serviceType, isCollected, page, limit } = queryResult.data;

    // Build where clause
    const where: Record<string, unknown> = {
      userId: tokenUser.userId,
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) (where.timestamp as Record<string, number>).gte = startDate;
      if (endDate) (where.timestamp as Record<string, number>).lte = endDate;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (serviceType) {
      where.serviceType = ServiceTypeToDb[serviceType];
    }

    if (isCollected !== undefined) {
      where.isCollected = isCollected === 'true';
    }

    // Get total count
    const total = await prisma.bill.count({ where });

    // Get bills with customer and rows
    const bills = await prisma.bill.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: ((page as number) - 1) * (limit as number),
      take: limit as number,
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

    // Transform response
    const transformedBills = bills.map((bill) => ({
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
      rows: (bill.rows || []).map((row) => ({
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
        collectionHistory: (row.collectionHistory || []).map(h => ({
          id: h.id,
          amount: Number(h.amount),
          timestamp: h.timestamp.toISOString(),
        })),
      })),
    }));

    return successResponse({
      bills: transformedBills,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get bills error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// POST /api/bills - Tạo bill mới
export async function POST(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    console.log('[createBill] raw body:', JSON.stringify(body));
    const result = CreateBillSchema.safeParse(body);
    if (!result.success) {
      console.error('[createBill] validation error:', JSON.stringify(result.error.format(), null, 2));
      return errorResponse(result.error.errors[0].message, 400);
    }

    const { customerId, serviceType, note, isCollected, paymentType, paymentMethod, rows } = result.data;
    console.log('[createBill] parsed paymentType:', paymentType, 'paymentMethod:', paymentMethod);
    console.log('[createBill] rows[0] paymentType:', rows[0]?.paymentType, 'paymentMethod:', rows[0]?.paymentMethod);

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

    // Calculate totals
    const calculation = calculateBill(rows, serviceType as ServiceType);

    // Create bill with rows
    const bill = await prisma.bill.create({
      data: {
        userId: tokenUser.userId,
        customerId,
        serviceType: ServiceTypeToDb[serviceType as ServiceType],
        note: note || null,
        isCollected: isCollected ?? false,
        paymentType: paymentType || null,
        paymentMethod: paymentMethod || null,
        totalAmount: calculation.totalAmount,
        totalFeeThu: calculation.totalFeeThu,
        totalProfit: calculation.totalProfit,
        totalBankLai: calculation.totalBankLai,
        totalTienAm: calculation.totalTienAm,
        totalPhiPhaiTra: calculation.totalPhiPhaiTra,
        timestamp: BigInt(Date.now()),
        rows: {
          create: rows.map((row) => ({
            rowUuid: row.id,
            amount: row.amount,
            swipedAmount: row.swipedAmount || null,
            feeGocPercent: row.feeGocPercent,
            feeThuPercent: row.feeThuPercent,
            rowNote: row.rowNote || null,
            bankName: row.bankName || null,
            paymentType: row.paymentType || null,
            paymentMethod: row.paymentMethod || null,
          })),
        },
      },
      include: {
        customer: true,
        rows: true,
      },
    });

    // ==========================================
    // AUTO-MERGE: Gộp bill ĐÁO THẺ ngay tại Backend
    // ==========================================
    if (customer.name !== 'Khách lẻ') {
      // 1. Tìm tất cả bill ĐÁO THẺ chưa gộp của khách này (bao gồm bill vừa tạo)
      const unmergedBills = await prisma.bill.findMany({
        where: {
          userId: tokenUser.userId,
          customerId,
          serviceType: 'DAO_THE',
          mergedBillId: null,
        },
      });

      if (unmergedBills.length >= 1) {
        // 2. Tìm MergedBill group ĐÁO THẺ đã tồn tại của khách này (chưa collected)
        const existingMerged = await prisma.mergedBill.findFirst({
          where: {
            userId: tokenUser.userId,
            customerId,
            isCollected: false,
            bills: {
              some: { serviceType: 'DAO_THE' },
            },
          },
          include: { bills: true },
        });

        if (existingMerged) {
          // ── Khách đã có group → thêm bill mới vào group cũ ──
          const allBills = [...unmergedBills];
          const totalAmount = allBills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
          const totalFeeThu = allBills.reduce((sum, b) => sum + Number(b.totalFeeThu), 0);
          const totalTienAm = allBills.reduce((sum, b) => sum + Number(b.totalTienAm), 0);
          const latestTimestamp = Math.max(...allBills.map((b) => Number(b.timestamp)));

          await prisma.bill.updateMany({
            where: { id: { in: allBills.map((b) => b.id) } },
            data: { mergedBillId: existingMerged.id },
          });

          await prisma.mergedBill.update({
            where: { id: existingMerged.id },
            data: {
              totalAmount,
              totalFeeThu,
              totalTienAm,
              timestamp: BigInt(latestTimestamp),
            },
          });

          bill.mergedBillId = existingMerged.id;
        } else if (unmergedBills.length >= 2) {
          // ── Chưa có group, có ≥2 bill → tạo group mới ──
          const totalAmount = unmergedBills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
          const totalFeeThu = unmergedBills.reduce((sum, b) => sum + Number(b.totalFeeThu), 0);
          const totalTienAm = unmergedBills.reduce((sum, b) => sum + Number(b.totalTienAm), 0);
          const latestTimestamp = BigInt(Math.max(...unmergedBills.map((b) => Number(b.timestamp))));

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

          await prisma.bill.updateMany({
            where: { id: { in: unmergedBills.map((b) => b.id) } },
            data: { mergedBillId: mergedBill.id },
          });

          bill.mergedBillId = mergedBill.id;
        }
      }
    }
    // ==========================================
    // KẾT THÚC AUTO-MERGE
    // ==========================================

    // Transform response
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
        collectionHistory: [],
      })),
    };

    return successResponse(response, 201);
  } catch (error) {
    console.error('Create bill error:', error);
    return errorResponse('Internal server error', 500);
  }
}
