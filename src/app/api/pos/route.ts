import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { corsOptionsResponse } from '@/lib/cors';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '@/lib/response';

// OPTIONS /api/pos - Handle CORS preflight
export async function OPTIONS() {
  return corsOptionsResponse();
}

// GET /api/pos - Lấy danh sách máy POS
export async function GET(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const posMachines = await prisma.pOSMachine.findMany({
      where: { userId: tokenUser.userId },
      orderBy: { name: 'asc' },
    });

    const transformed = posMachines.map((pos) => ({
      id: pos.id,
      name: pos.name,
      code: pos.code || undefined,
      feePercent: pos.feePercent,
      note: pos.note || undefined,
      isActive: pos.isActive,
      createdAt: pos.createdAt,
      updatedAt: pos.updatedAt,
    }));

    return successResponse({ posMachines: transformed });
  } catch (error) {
    console.error('Get POS machines error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// POST /api/pos - Thêm máy POS mới
export async function POST(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { name, code, feePercent, note, isActive } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return errorResponse('Tên máy POS không hợp lệ', 400);
    }

    // Check if POS already exists for this user
    const existingPOS = await prisma.pOSMachine.findFirst({
      where: {
        userId: tokenUser.userId,
        name: name.trim(),
      },
    });

    if (existingPOS) {
      return errorResponse('Máy POS đã tồn tại', 400);
    }

    const posMachine = await prisma.pOSMachine.create({
      data: {
        userId: tokenUser.userId,
        name: name.trim(),
        code: code?.trim() || null,
        feePercent: feePercent ?? 0,
        note: note?.trim() || null,
        isActive: isActive ?? true,
      },
    });

    const response = {
      id: posMachine.id,
      name: posMachine.name,
      code: posMachine.code || undefined,
      feePercent: posMachine.feePercent,
      note: posMachine.note || undefined,
      isActive: posMachine.isActive,
      createdAt: posMachine.createdAt,
      updatedAt: posMachine.updatedAt,
    };

    return successResponse(response, 201);
  } catch (error) {
    console.error('Create POS machine error:', error);
    return errorResponse('Internal server error', 500);
  }
}
