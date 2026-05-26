import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { BankSettingsSchema } from '@/lib/validators';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/response';
import { corsOptionsResponse } from '@/lib/cors';

export async function OPTIONS() {
  return corsOptionsResponse();
}

const DEFAULT_BANK_SETTINGS = {
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  qrImage: '',
};

// GET /api/bank-settings - Lấy cài đặt ngân hàng
export async function GET(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const bankSettings = await prisma.bankSettings.findUnique({
      where: { userId: tokenUser.userId },
    });

    if (!bankSettings) {
      return successResponse(DEFAULT_BANK_SETTINGS);
    }

    return successResponse({
      bankName: bankSettings!.bankName,
      accountNumber: bankSettings!.accountNumber,
      accountHolder: bankSettings!.accountHolder,
      qrImage: bankSettings!.qrImage || '',
    });
  } catch (error) {
    console.error('Get bank settings error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// PUT /api/bank-settings - Cập nhật cài đặt ngân hàng
export async function PUT(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const result = BankSettingsSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(result.error.errors[0].message, 400);
    }

    const { bankName, accountNumber, accountHolder, qrImage } = result.data;

    // Use raw SQL to avoid Prisma metadata constraint on qrImage field length
    const upsertSql = `
      INSERT INTO bank_settings (user_id, bank_name, account_number, account_holder, qr_image, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        bank_name = VALUES(bank_name),
        account_number = VALUES(account_number),
        account_holder = VALUES(account_holder),
        qr_image = VALUES(qr_image),
        updated_at = NOW()
    `;
    
    await prisma.$executeRawUnsafe(upsertSql, tokenUser.userId, bankName, accountNumber, accountHolder, qrImage || '');

    // Fetch the result
    const bankSettings = await prisma.bankSettings.findUnique({
      where: { userId: tokenUser.userId },
    });

    return successResponse({
      bankName: bankSettings!.bankName,
      accountNumber: bankSettings!.accountNumber,
      accountHolder: bankSettings!.accountHolder,
      qrImage: bankSettings!.qrImage || '',
    });
  } catch (error) {
    console.error('Update bank settings error:', error);
    return errorResponse('Internal server error', 500);
  }
}
