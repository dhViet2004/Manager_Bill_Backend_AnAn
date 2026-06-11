import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { DbToServiceType, ServiceType } from '@/types';
import { successResponse, unauthorizedResponse } from '@/lib/response';

export const dynamic = 'force-dynamic';

// GET /api/bills/unmerged - Lấy tất cả bill chưa gộp, không phân trang
export async function GET(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    // Build where clause: chỉ lấy bill CHƯA gộp (mergedBillId IS NULL)
    const where: Record<string, unknown> = {
      userId: tokenUser.userId,
      mergedBillId: null,
    };

    if (customerId) {
      where.customerId = parseInt(customerId, 10);
    }

    const bills = await prisma.bill.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      include: {
        customer: true,
      },
    });

    const transformed = bills.map((bill) => ({
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
    }));

    return successResponse({ bills: transformed });
  } catch (error) {
    console.error('Get unmerged bills error:', error);
    return successResponse({ bills: [] });
  }
}
