export interface Payment {
  id?: number;
  student_id: number;
  month_year: string; // YYYY-MM
  amount_due: number;
  amount_paid: number;
  due_date: string; // YYYY-MM-DD
  paid_date: string | null;
  status: 'pending' | 'paid' | 'overdue';
}

export interface PaymentRecord extends Payment {
  student_name: string;
  whatsapp_number: string;
}

export interface FeePlan {
  id?: number;
  dojo_id: number;
  name: string;
  monthly_amount: number;
}

export interface StudentFeePlan {
  student_id: number;
  fee_plan_id: number;
}
