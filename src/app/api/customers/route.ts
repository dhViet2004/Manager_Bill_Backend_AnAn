import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { CustomerSchema } from '@/lib/validators';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/response';

// GET /api/customers - Lấy danh sách khách hàng
export async function GET(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const customers = await prisma.customer.findMany({
      where: { userId: tokenUser.userId },
      orderBy: { name: 'asc' },
    });

    const transformed = customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || undefined,
      address: c.address || undefined,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return successResponse({ customers: transformed });
  } catch (error) {
    console.error('Get customers error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// POST /api/customers - Tạo khách hàng mới
export async function POST(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const result = CustomerSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(result.error.errors[0].message, 400);
    }

    const { name, phone, address } = result.data;

    // Check if customer with same name already exists for this user
    const existing = await prisma.customer.findFirst({
      where: {
        userId: tokenUser.userId,
        name,
      },
    });

    if (existing) {
      return errorResponse('Khách hàng đã tồn tại', 400);
    }

    const customer = await prisma.customer.create({
      data: {
        userId: tokenUser.userId,
        name,
        phone: phone || null,
        address: address || null,
      },
    });

    const response = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone || undefined,
      address: customer.address || undefined,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };

    return successResponse(response, 201);
  } catch (error) {
    console.error('Create customer error:', error);
    return errorResponse('Internal server error', 500);
  }
}
