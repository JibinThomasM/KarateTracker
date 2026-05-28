export interface Payment {
  id?: string;
  studentId: string;
  dojoId: string;
  monthYear: string; // YYYY-MM
  amountDue: number;
  amountPaid: number;
  dueDate: string; // YYYY-MM-DD
  paidDate: string | null;
  status: 'pending' | 'paid' | 'overdue';
  studentName: string;
  whatsappNumber: string;
}

export type PaymentRecord = Payment;

export interface FeePlan {
  id?: string;
  dojoId: string;
  name: string;
  monthlyAmount: number;
}

export interface Reminder {
  id?: string;
  paymentId: string;
  studentId: string;
  dojoId: string;
  studentName: string;
  whatsappNumber: string;
  sentAt: string;
  monthYear: string;
}
