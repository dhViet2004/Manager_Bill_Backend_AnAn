import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { StatsQuerySchema } from '@/lib/validators';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/response';

export async function GET(request: NextRequest) {
  try {
    const tokenUser = await getCurrentUser(request);
    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const queryParams = {
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      groupBy: searchParams.get('groupBy') || 'day',
    };

    const queryResult = StatsQuerySchema.safeParse(queryParams);
    if (!queryResult.success) {
      return errorResponse(queryResult.error.errors[0].message, 400);
    }

    const { startDate, endDate, groupBy } = queryResult.data;

    // Get all bills in date range
    const bills = await prisma.bill.findMany({
      where: {
        userId: tokenUser.userId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        timestamp: true,
        totalAmount: true,
        totalFeeThu: true,
        totalProfit: true,
      },
    });

    // Calculate totals
    const totalRevenue = bills.reduce((sum, bill) => sum + Number(bill.totalFeeThu), 0);
    const totalProfit = bills.reduce((sum, bill) => sum + Number(bill.totalProfit), 0);
    const totalBills = bills.length;

    // Group by period
    const statsMap = new Map<string, {
      totalAmount: number;
      totalFeeThu: number;
      totalProfit: number;
      billCount: number;
    }>();

    bills.forEach((bill) => {
      const date = new Date(Number(bill.timestamp));
      let periodKey: string;

      switch (groupBy) {
        case 'week':
          // Get start of week (Monday)
          const dayOfWeek = date.getDay();
          const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          const weekStart = new Date(date);
          weekStart.setDate(diff);
          periodKey = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default: // day
          periodKey = date.toISOString().split('T')[0];
      }

      const existing = statsMap.get(periodKey) || {
        totalAmount: 0,
        totalFeeThu: 0,
        totalProfit: 0,
        billCount: 0,
      };

      statsMap.set(periodKey, {
        totalAmount: existing.totalAmount + Number(bill.totalAmount),
        totalFeeThu: existing.totalFeeThu + Number(bill.totalFeeThu),
        totalProfit: existing.totalProfit + Number(bill.totalProfit),
        billCount: existing.billCount + 1,
      });
    });

    // Convert to array and sort by period
    const stats = Array.from(statsMap.entries())
      .map(([period, data]) => ({
        period,
        ...data,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return successResponse({
      totalRevenue,
      totalProfit,
      totalBills,
      stats,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return errorResponse('Internal server error', 500);
  }
}
