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

const transformBank = (bank: any) => ({
  id: bank.id,
  name: bank.name,
  code: bank.code || undefined,
  cardHolderName: bank.cardHolderName || undefined,
  cardType: bank.cardType || undefined,
  lastFourDigits: bank.lastFourDigits || undefined,
  collaboratorName: bank.collaboratorName || undefined,
  collaboratorId: bank.collaboratorId || undefined,
  isReturned: bank.isReturned,
  collaborator: bank.collaborator ? {
    id: bank.collaborator.id,
    name: bank.collaborator.name,
    phone: bank.collaborator.phone || undefined,
    isActive: bank.collaborator.isActive
  } : undefined,
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
      include: {
        collaborator: true,
      },
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
      code,
      cardHolderName,
      cardType,
      lastFourDigits,
      collaboratorName,
      collaboratorId,
      isReturned,
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

    // Resolve collaboratorName if collaboratorId is provided
    let finalCollaboratorName = toOptionalString(collaboratorName);
    const parsedCollaboratorId = collaboratorId ? Number(collaboratorId) : null;
    if (parsedCollaboratorId) {
      const collaborator = await prisma.collaborator.findUnique({
        where: { id: parsedCollaboratorId },
      });
      if (collaborator) {
        finalCollaboratorName = collaborator.name;
      }
    }

    const bank = await prisma.bank.create({
      data: {
        userId: tokenUser.userId,
        name: normalizedName,
        code: toOptionalString(code),
        cardHolderName: toOptionalString(cardHolderName),
        cardType: toOptionalString(cardType),
        lastFourDigits: normalizedLastFourDigits,
        collaboratorName: finalCollaboratorName,
        collaboratorId: parsedCollaboratorId,
        isReturned: typeof isReturned === 'boolean' ? isReturned : false,
      },
      include: {
        collaborator: true,
      },
    });

    return successResponse(transformBank(bank), 201);
  } catch (error) {
    console.error('Create bank error:', error);
    return errorResponse('Internal server error', 500);
  }
}
