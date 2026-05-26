import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { corsOptionsResponse } from '@/lib/cors';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '@/lib/response';

// OPTIONS /api/banks - Handle CORS preflight
export async function OPTIONS() {
  return corsOptionsResponse();
}

// GET /api/banks - Lấy danh sách ngân hàng
export async function GET(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const banks = await prisma.bank.findMany({
      where: { userId: tokenUser.userId },
      orderBy: { name: 'asc' },
    });

    const transformed = banks.map((bank) => ({
      id: bank.id,
      name: bank.name,
      shortName: bank.shortName || undefined,
      code: bank.code || undefined,
      createdAt: bank.createdAt,
      updatedAt: bank.updatedAt,
    }));

    return successResponse({ banks: transformed });
  } catch (error) {
    console.error('Get banks error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// POST /api/banks - Thêm ngân hàng mới
export async function POST(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { name, shortName, code } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return errorResponse('Tên ngân hàng không hợp lệ', 400);
    }

    // Check if bank already exists for this user
    const existingBank = await prisma.bank.findFirst({
      where: {
        userId: tokenUser.userId,
        name: name.trim(),
      },
    });

    if (existingBank) {
      return errorResponse('Ngân hàng đã tồn tại', 400);
    }

    const bank = await prisma.bank.create({
      data: {
        userId: tokenUser.userId,
        name: name.trim(),
        shortName: shortName?.trim() || null,
        code: code?.trim() || null,
      },
    });

    const response = {
      id: bank.id,
      name: bank.name,
      shortName: bank.shortName || undefined,
      code: bank.code || undefined,
      createdAt: bank.createdAt,
      updatedAt: bank.updatedAt,
    };

    return successResponse(response, 201);
  } catch (error) {
    console.error('Create bank error:', error);
    return errorResponse('Internal server error', 500);
  }
}
