import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { CustomerHistoryQuerySchema } from '@/lib/validators';
import { ServiceTypeToDb, DbToServiceType, ServiceType } from '@/types';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/response';

// GET /api/customers/[id]/history - Lấy lịch sử khách hàng
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
    const customerId = parseInt(id, 10);

    if (isNaN(customerId)) {
      return errorResponse('Invalid customer ID', 400);
    }

    // Verify customer exists and belongs to user
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        userId: tokenUser.userId,
      },
    });

    if (!customer) {
      return notFoundResponse('Customer not found');
    }

    const { searchParams } = new URL(request.url);
    const serviceTypeParam = searchParams.get('serviceType');

    const queryResult = CustomerHistoryQuerySchema.safeParse({
      serviceType: serviceTypeParam,
    });

    if (!queryResult.success) {
      return errorResponse(queryResult.error.errors[0].message, 400);
    }

    const { serviceType } = queryResult.data;

    // Build where clause
    const where: Record<string, unknown> = {
      userId: tokenUser.userId,
      customerId,
    };

    if (serviceType) {
      where.serviceType = ServiceTypeToDb[serviceType];
    }

    // Get bills
    const bills = await prisma.bill.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        timestamp: true,
        serviceType: true,
        totalAmount: true,
        totalProfit: true,
      },
    });

    const response = {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone || undefined,
        address: customer.address || undefined,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      bills: bills.map((bill) => ({
        id: bill.id,
        timestamp: Number(bill.timestamp),
        serviceType: DbToServiceType[bill.serviceType] as ServiceType,
        totalAmount: Number(bill.totalAmount),
        totalProfit: Number(bill.totalProfit),
      })),
    };

    return successResponse(response);
  } catch (error) {
    console.error('Get customer history error:', error);
    return errorResponse('Internal server error', 500);
  }
}
