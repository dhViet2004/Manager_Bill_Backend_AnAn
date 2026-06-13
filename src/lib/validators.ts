import { z } from 'zod';

// Service Type Enum
export const ServiceTypeEnum = z.enum(['RÚT / CHUYỂN', 'ĐÁO THẺ']);

// Customer Schema
export const CustomerSchema = z.object({
  name: z.string().min(1, 'Tên khách hàng không được trống'),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// Bill Row Schema
export const BillRowSchema = z.object({
  id: z.string().min(1),
  amount: z.number().positive('Số tiền phải lớn hơn 0'),
  swipedAmount: z.number().optional(),
  feeGocPercent: z.number().min(0).max(100),
  feeThuPercent: z.number().min(0).max(100),
  rowNote: z.string().optional(),
  bankId: z.number().int().positive().nullable().optional(),
  bankName: z.string().optional(),
  collectionAmount: z.number().optional(),
  paymentType: z.enum(['QR', 'POS']).optional(),
  paymentMethod: z.enum(['QR', 'POS', 'Link']).optional(),
});

// Assignee Schema
export const AssigneeSchema = z.object({
  name: z.string().min(1, 'Tên người phụ trách không được trống'),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

// Collaborator Schema
export const CollaboratorSchema = z.object({
  name: z.string().min(1, 'Tên cộng tác viên không được trống'),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

// Bill Schema
export const CreateBillSchema = z.object({
  customerId: z.number().int().positive('ID khách hàng không hợp lệ'),
  assigneeId: z.number().int().positive().optional().nullable(),
  serviceType: ServiceTypeEnum,
  note: z.string().optional(),
  useGlobalFee: z.boolean().optional(),
  globalFeeGocPercent: z.number().optional(),
  globalFeeThuPercent: z.number().optional(),
  isCollected: z.boolean().optional().default(false),
  paymentType: z.enum(['QR', 'POS']).optional(),
  paymentMethod: z.enum(['QR', 'POS', 'Link']).optional(),
  rows: z.array(BillRowSchema).min(1, 'Phải có ít nhất 1 dòng'),
});

// Update Bill Schema - Chỉ cho phép cập nhật các field được phép thay đổi
export const UpdateBillSchema = z.object({
  customerId: z.number().int().positive().optional(),
  assigneeId: z.number().int().positive().optional().nullable(),
  serviceType: ServiceTypeEnum.optional(),
  note: z.string().optional().nullable(),
  isCollected: z.boolean().optional(),
  paymentType: z.enum(['QR', 'POS']).optional().nullable(),
  paymentMethod: z.enum(['QR', 'POS', 'Link']).optional().nullable(),
  rows: z.array(BillRowSchema).optional(),
  collectionEntries: z.array(z.object({
    rowId: z.string().min(1),
    amount: z.number().positive(),
  })).optional(),
  posEntries: z.array(z.object({
    rowId: z.string().min(1),
    type: z.enum(['DEPOSIT', 'WITHDRAW']),
    amount: z.number().positive(),
  })).optional(),
});

// Auth Schemas
export const LoginSchema = z.object({
  username: z.string().min(1, 'Username không được trống'),
  password: z.string().min(1, 'Password không được trống'),
});


// Bank Settings Schema
export const BankSettingsSchema = z.object({
  bankName: z.string().min(1, 'Tên ngân hàng không được trống'),
  accountNumber: z.string().min(1, 'Số tài khoản không được trống'),
  accountHolder: z.string().min(1, 'Tên chủ tài khoản không được trống'),
  qrImage: z.string().optional(),
});

// Query Schemas
export const BillsQuerySchema = z.object({
  startDate: z.coerce.number().optional(),
  endDate: z.coerce.number().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  serviceType: ServiceTypeEnum.optional(),
  isCollected: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(5000).default(20),
});

export const StatsQuerySchema = z.object({
  startDate: z.coerce.number(),
  endDate: z.coerce.number(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

export const CustomerHistoryQuerySchema = z.object({
  serviceType: ServiceTypeEnum.optional(),
});
