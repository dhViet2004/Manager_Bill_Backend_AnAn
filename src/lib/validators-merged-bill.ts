import { z } from 'zod';

export const ServiceTypeEnum = z.enum(['RÚT / CHUYỂN', 'ĐÁO THẺ']);

export const MergeBillsSchema = z.object({
  billIds: z.array(z.number().int().positive()).min(2, 'Phải chọn ít nhất 2 bill để gộp'),
  customerId: z.number().int().positive('ID khách hàng không hợp lệ'),
});
