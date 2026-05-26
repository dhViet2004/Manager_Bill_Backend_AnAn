import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { CustomerSchema } from '@/lib/validators';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/response';

// GET /api/customers/[id] - Lấy chi tiết khách hàng
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

    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        userId: tokenUser.userId,
      },
    });

    if (!customer) {
      return notFoundResponse('Customer not found');
    }

    const response = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone || undefined,
      address: customer.address || undefined,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };

    return successResponse(response);
  } catch (error) {
    console.error('Get customer error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// PUT /api/customers/[id] - Cập nhật khách hàng
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
    const customerId = parseInt(id, 10);

    if (isNaN(customerId)) {
      return errorResponse('Invalid customer ID', 400);
    }

    // Check if customer exists and belongs to user
    const existing = await prisma.customer.findFirst({
      where: {
        id: customerId,
        userId: tokenUser.userId,
      },
    });

    if (!existing) {
      return notFoundResponse('Customer not found');
    }

    const body = await request.json();
    const result = CustomerSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(result.error.errors[0].message, 400);
    }

    const { name, phone, address } = result.data;

    // Check if another customer with same name exists
    if (name !== existing.name) {
      const duplicate = await prisma.customer.findFirst({
        where: {
          userId: tokenUser.userId,
          name,
          id: { not: customerId },
        },
      });
      if (duplicate) {
        return errorResponse('Tên khách hàng đã tồn tại', 400);
      }
    }

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
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

    return successResponse(response);
  } catch (error) {
    console.error('Update customer error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// DELETE /api/customers/[id] - Xóa khách hàng
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
    const customerId = parseInt(id, 10);

    if (isNaN(customerId)) {
      return errorResponse('Invalid customer ID', 400);
    }

    // Check if customer exists and belongs to user
    const existing = await prisma.customer.findFirst({
      where: {
        id: customerId,
        userId: tokenUser.userId,
      },
    });

    if (!existing) {
      return notFoundResponse('Customer not found');
    }

    // Check if customer has any bills
    const billCount = await prisma.bill.count({
      where: { customerId },
    });

    if (billCount > 0) {
      return errorResponse('Khách hàng có bill liên quan, không thể xóa', 400);
    }

    await prisma.customer.delete({
      where: { id: customerId },
    });

    return successResponse({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    return errorResponse('Internal server error', 500);
  }
}
