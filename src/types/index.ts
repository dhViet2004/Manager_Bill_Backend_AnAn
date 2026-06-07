// Service Types
export type ServiceType = 'RÚT / CHUYỂN' | 'ĐÁO THẺ';

// Database enum mapping (ASCII safe for SQLite)
export const ServiceTypeToDb: Record<ServiceType, string> = {
  'RÚT / CHUYỂN': 'RUT_CHUYEN',
  'ĐÁO THẺ': 'DAO_THE',
};

export const DbToServiceType: Record<string, ServiceType> = {
  RUT_CHUYEN: 'RÚT / CHUYỂN',
  DAO_THE: 'ĐÁO THẺ',
};

// Customer
export interface CustomerInput {
  name: string;
  phone?: string;
  address?: string;
}

export interface CustomerResponse {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Bill Row
export interface BillRowInput {
  id: string;
  amount: number;
  swipedAmount?: number;
  feeGocPercent: number;
  feeThuPercent: number;
  rowNote?: string;
  bankName?: string;
  paymentType?: string;
  paymentMethod?: string;
}

export interface CollectionHistoryEntryResponse {
  id: number;
  amount: number;
  timestamp: string;
}

export interface BillRowResponse {
  id: number;
  rowUuid: string;
  amount: number;
  swipedAmount?: number;
  feeGocPercent: number;
  feeThuPercent: number;
  rowNote?: string;
  bankName?: string;
  paymentType?: string;
  paymentMethod?: string;
  collectionHistory?: CollectionHistoryEntryResponse[];
}

// Bill
export interface BillInput {
  customerId: number;
  serviceType: ServiceType;
  note?: string;
  useGlobalFee?: boolean;
  globalFeeGocPercent?: number;
  globalFeeThuPercent?: number;
  isCollected?: boolean;
  rows: BillRowInput[];
}

export interface BillResponse {
  id: number;
  timestamp: number;
  customerId: number;
  customer?: CustomerResponse;
  serviceType: ServiceType;
  note?: string;
  totalAmount: number;
  totalFeeThu: number;
  totalProfit: number;
  totalBankLai: number;
  totalTienAm: number;
  totalPhiPhaiTra: number;
  isCollected: boolean;
  rows: BillRowResponse[];
  mergedBillId?: number | null;
}

export interface BillListItem {
  id: number;
  timestamp: number;
  customerId: number;
  customer?: CustomerResponse;
  serviceType: ServiceType;
  totalAmount: number;
  totalFeeThu: number;
  totalProfit: number;
  isCollected: boolean;
  mergedBillId?: number | null;
}

export interface BillListResponse {
  bills: BillListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Bank Settings
export interface BankSettingsInput {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  qrImage?: string;
}

export interface BankSettingsResponse {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  qrImage?: string;
}

// Bank
export interface BankResponse {
  id: number;
  name: string;
  shortName?: string;
  code?: string;
  cardHolderName?: string;
  cardType?: string;
  lastFourDigits?: string;
  posMachineName?: string;
  collaboratorName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankInput {
  name: string;
  shortName?: string;
  code?: string;
  cardHolderName?: string;
  cardType?: string;
  lastFourDigits?: string;
  posMachineName?: string;
  collaboratorName?: string;
}

// POS Machine
export interface POSMachineResponse {
  id: number;
  name: string;
  code?: string;
  feePercent: number;
  note?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface POSMachineInput {
  name: string;
  code?: string;
  feePercent?: number;
  note?: string;
  isActive?: boolean;
}

// Auth
export interface UserResponse {
  id: number;
  username: string;
  displayName?: string;
  photoURL?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: UserResponse;
  token: string;
}

// Stats
export interface StatsPeriod {
  period: string;
  totalAmount: number;
  totalFeeThu: number;
  totalProfit: number;
  billCount: number;
}

export interface StatsResponse {
  totalRevenue: number;
  totalProfit: number;
  totalBills: number;
  stats: StatsPeriod[];
}

// Merged Bills
export interface MergedBillResponse {
  id: number;
  userId: number;
  customerId: number;
  customer?: CustomerResponse;
  totalAmount: number;
  totalFeeThu: number;
  totalTienAm: number;
  isCollected: boolean;
  timestamp: number;
  createdAt: Date;
  updatedAt: Date;
  bills?: BillResponse[];
}

export interface MergeBillsRequest {
  billIds: number[];
  customerId: number;
}

// Customer History
export interface CustomerHistoryItem {
  id: number;
  timestamp: number;
  serviceType: ServiceType;
  totalAmount: number;
  totalProfit: number;
}

export interface CustomerHistoryResponse {
  customer: CustomerResponse;
  bills: CustomerHistoryItem[];
}

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// JWT Payload
export interface JWTPayload {
  userId: number;
  username: string;
  iat?: number;
  exp?: number;
}
