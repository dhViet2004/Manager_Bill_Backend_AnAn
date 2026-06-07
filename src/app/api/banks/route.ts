import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { corsOptionsResponse } from '@/lib/cors';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
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
  shortName: string | null;
  code: string | null;
  cardHolderName: string | null;
  cardType: string | null;
  lastFourDigits: string | null;
  posMachineName: string | null;
  collaboratorName: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: bank.id,
  name: bank.name,
  shortName: bank.shortName || undefined,
  code: bank.code || undefined,
  cardHolderName: bank.cardHolderName || undefined,
  cardType: bank.cardType || undefined,
  lastFourDigits: bank.lastFourDigits || undefined,
  posMachineName: bank.posMachineName || undefined,
  collaboratorName: bank.collaboratorName || undefined,
  createdAt: bank.createdAt,
  updatedAt: bank.updatedAt,
});

// OPTIONS /api/banks - Handle CORS preflight
export async function OPTIONS() {
  return corsOptionsResponse();
}

// GET /api/banks - Lay danh sach the
export async function GET(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const banks = await prisma.bank.findMany({
      where: { userId: tokenUser.userId },
      orderBy: [{ name: 'asc' }, { lastFourDigits: 'asc' }],
    });

    return successResponse({ banks: banks.map(transformBank) });
  } catch (error) {
    console.error('Get banks error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// POST /api/banks - Them the moi
export async function POST(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const {
      name,
      shortName,
      code,
      cardHolderName,
      cardType,
      lastFourDigits,
      posMachineName,
      collaboratorName,
    } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return errorResponse('Ten ngan hang khong hop le', 400);
    }

    const normalizedName = name.trim();
    const normalizedLastFourDigits = toLastFourDigits(lastFourDigits);

    const existingBank = await prisma.bank.findFirst({
      where: {
        userId: tokenUser.userId,
        name: normalizedName,
        lastFourDigits: normalizedLastFourDigits,
      },
    });

    if (existingBank) {
      return errorResponse('The da ton tai', 400);
    }

    const bank = await prisma.bank.create({
      data: {
        userId: tokenUser.userId,
        name: normalizedName,
        shortName: toOptionalString(shortName),
        code: toOptionalString(code),
        cardHolderName: toOptionalString(cardHolderName),
        cardType: toOptionalString(cardType),
        lastFourDigits: normalizedLastFourDigits,
        posMachineName: toOptionalString(posMachineName),
        collaboratorName: toOptionalString(collaboratorName),
      },
    });

    return successResponse(transformBank(bank), 201);
  } catch (error) {
    console.error('Create bank error:', error);
    return errorResponse('Internal server error', 500);
  }
}
