import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { corsOptionsResponse } from '@/lib/cors';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
} from '@/lib/response';

const toOptionalString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const toLastFourDigits = (value: unknown) => {
  const normalized = toOptionalString(value);
  if (!normalized) return null;
  return normalized.replace(/\D/g, '').slice(-4) || null;
};

const transformBank = (bank: {
  id: number;
  name: string;
  code: string | null;
  cardHolderName: string | null;
  cardType: string | null;
  lastFourDigits: string | null;
  collaboratorName: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: bank.id,
  name: bank.name,
  code: bank.code || undefined,
  cardHolderName: bank.cardHolderName || undefined,
  cardType: bank.cardType || undefined,
  lastFourDigits: bank.lastFourDigits || undefined,
  collaboratorName: bank.collaboratorName || undefined,
  createdAt: bank.createdAt,
  updatedAt: bank.updatedAt,
});

// OPTIONS /api/banks/[id] - Handle CORS preflight
export async function OPTIONS() {
  return corsOptionsResponse();
}

// PUT /api/banks/[id] - Cap nhat the
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
    const bankId = parseInt(id, 10);

    if (isNaN(bankId)) {
      return errorResponse('Invalid bank ID', 400);
    }

    const body = await request.json();
    const {
      name,
      code,
      cardHolderName,
      cardType,
      lastFourDigits,
      collaboratorName,
    } = body;

    const existingBank = await prisma.bank.findFirst({
      where: {
        id: bankId,
        userId: tokenUser.userId,
      },
    });

    if (!existingBank) {
      return notFoundResponse('Bank not found');
    }

    const normalizedName = typeof name === 'string' && name.trim()
      ? name.trim()
      : existingBank.name;
    const normalizedLastFourDigits = lastFourDigits !== undefined
      ? toLastFourDigits(lastFourDigits)
      : existingBank.lastFourDigits;

    const conflictingBank = await prisma.bank.findFirst({
      where: {
        userId: tokenUser.userId,
        name: normalizedName,
        lastFourDigits: normalizedLastFourDigits,
        id: { not: bankId },
      },
    });

    if (conflictingBank) {
      return errorResponse('The da ton tai', 400);
    }

    const bank = await prisma.bank.update({
      where: { id: bankId },
      data: {
        name: normalizedName,
        code: code !== undefined ? toOptionalString(code) : existingBank.code,
        cardHolderName: cardHolderName !== undefined ? toOptionalString(cardHolderName) : existingBank.cardHolderName,
        cardType: cardType !== undefined ? toOptionalString(cardType) : existingBank.cardType,
        lastFourDigits: normalizedLastFourDigits,
        collaboratorName: collaboratorName !== undefined ? toOptionalString(collaboratorName) : existingBank.collaboratorName,
      },
    });

    return successResponse(transformBank(bank));
  } catch (error) {
    console.error('Update bank error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// DELETE /api/banks/[id] - Xoa the
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
    const bankId = parseInt(id, 10);

    if (isNaN(bankId)) {
      return errorResponse('Invalid bank ID', 400);
    }

    const existingBank = await prisma.bank.findFirst({
      where: {
        id: bankId,
        userId: tokenUser.userId,
      },
    });

    if (!existingBank) {
      return notFoundResponse('Bank not found');
    }

    await prisma.bank.delete({
      where: { id: bankId },
    });

    return successResponse({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error('Delete bank error:', error);
    return errorResponse('Internal server error', 500);
  }
}
