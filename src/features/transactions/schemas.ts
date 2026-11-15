import { z } from 'zod';

export const transactionSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  date: z.string().min(1, 'Date and time are required'),
  merchant: z.string().trim().min(1, 'Merchant / payee is required'),
  categoryId: z.string().min(1, 'Category is required'),
  subcategoryId: z.string().nullable().optional(),
  paymentMethod: z.enum(['upi', 'card', 'cash', 'net_banking', 'wallet']),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  receiptImage: z.string().nullable().optional(),
  createRecurring: z.boolean().optional(),
  recurringCadence: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;
