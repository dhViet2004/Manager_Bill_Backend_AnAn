import { ServiceType, BillRowInput } from '@/types';

export interface CalculatedRow {
  amount: number;
  swipedAmount?: number;
  feeGocPercent: number;
  feeThuPercent: number;
  phiKhachTra: number;
  phiGoc: number;
  loiNhuan: number;
  tienNo?: number;
}

export interface BillCalculation {
  totalAmount: number;
  totalFeeThu: number;
  totalProfit: number;
  totalBankLai: number;
  totalTienAm: number;
  totalPhiPhaiTra: number;
  rows: CalculatedRow[];
}

/**
 * Tính phí cho 1 dòng - RÚT / CHUYỂN
 */
function calculateRow_RUT_CHUYEN(row: BillRowInput): CalculatedRow {
  const amount = row.amount;
  const feeGocPercent = row.feeGocPercent;
  const feeThuPercent = row.feeThuPercent;

  const phiKhachTra = amount * (feeThuPercent / 100);
  const phiGoc = amount * (feeGocPercent / 100);
  const loiNhuan = phiKhachTra - phiGoc;

  return {
    amount,
    feeGocPercent,
    feeThuPercent,
    phiKhachTra,
    phiGoc,
    loiNhuan,
  };
}

/**
 * Tính phí cho 1 dòng - ĐÁO THẺ
 */
function calculateRow_DAO_THE(row: BillRowInput): CalculatedRow {
  const amount = row.amount;
  const swipedAmount = row.swipedAmount || 0;
  const feeGocPercent = row.feeGocPercent;
  const feeThuPercent = row.feeThuPercent;

  const phiKhachTra = swipedAmount * (feeThuPercent / 100);
  const phiGoc = swipedAmount * (feeGocPercent / 100);
  const loiNhuan = phiKhachTra - phiGoc;
  const tienNo = Math.max(amount - swipedAmount, 0);

  return {
    amount,
    swipedAmount,
    feeGocPercent,
    feeThuPercent,
    phiKhachTra,
    phiGoc,
    loiNhuan,
    tienNo,
  };
}

/**
 * Tính toán toàn bộ bill
 */
export function calculateBill(rows: BillRowInput[], serviceType: ServiceType): BillCalculation {
  let totalAmount = 0;
  let totalFeeThu = 0;
  let totalProfit = 0;
  let totalBankLai = 0;
  let totalTienAm = 0;
  let totalPhiPhaiTra = 0;

  const calculatedRows: CalculatedRow[] = rows.map((row) => {
    const calculated =
      serviceType === 'ĐÁO THẺ'
        ? calculateRow_DAO_THE(row)
        : calculateRow_RUT_CHUYEN(row);

    totalAmount += row.amount;
    totalFeeThu += calculated.phiKhachTra;
    totalProfit += calculated.loiNhuan;
    totalBankLai += row.amount;
    totalPhiPhaiTra += calculated.phiGoc;

    if (serviceType === 'ĐÁO THẺ' && calculated.tienNo) {
      totalTienAm += calculated.tienNo;
    }

    return calculated;
  });

  return {
    totalAmount,
    totalFeeThu,
    totalProfit,
    totalBankLai,
    totalTienAm,
    totalPhiPhaiTra,
    rows: calculatedRows,
  };
}

/**
 * Format số tiền VND
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

/**
 * Parse số tiền từ string
 */
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, '').replace(/,/g, '');
  return parseInt(cleaned, 10) || 0;
}
