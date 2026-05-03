import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { DojoService } from './dojo.service';
import { Payment, PaymentRecord, FeePlan } from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  constructor(private dbService: DatabaseService, private dojoService: DojoService) {}

  private get dojoId(): number {
    return this.dojoService.getSelectedDojoId();
  }

  // Fee Plans
  getFeePlans(): FeePlan[] {
    return this.dbService.query<FeePlan>('SELECT * FROM fee_plans WHERE dojo_id = ? ORDER BY name', [this.dojoId]);
  }

  addFeePlan(plan: Omit<FeePlan, 'id'>): void {
    this.dbService.run('INSERT INTO fee_plans (name, monthly_amount, dojo_id) VALUES (?, ?, ?)',
      [plan.name, plan.monthly_amount, this.dojoId]);
  }

  updateFeePlan(plan: FeePlan): void {
    this.dbService.run('UPDATE fee_plans SET name = ?, monthly_amount = ? WHERE id = ? AND dojo_id = ?',
      [plan.name, plan.monthly_amount, plan.id, this.dojoId]);
  }

  deleteFeePlan(id: number): void {
    this.dbService.run('DELETE FROM fee_plans WHERE id = ? AND dojo_id = ?', [id, this.dojoId]);
  }

  // Payments
  getPayments(monthYear?: string, status?: string): PaymentRecord[] {
    let sql = `SELECT p.*, s.name as student_name, s.whatsapp_number
               FROM payments p
               JOIN students s ON s.id = p.student_id
               WHERE s.dojo_id = ?`;
    const params: unknown[] = [this.dojoId];

    if (monthYear) {
      sql += ' AND p.month_year = ?';
      params.push(monthYear);
    }
    if (status) {
      sql += ' AND p.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY s.name';
    return this.dbService.query<PaymentRecord>(sql, params);
  }

  getOverduePayments(): PaymentRecord[] {
    const today = new Date().toISOString().split('T')[0];
    return this.dbService.query<PaymentRecord>(
      `SELECT p.*, s.name as student_name, s.whatsapp_number
       FROM payments p
       JOIN students s ON s.id = p.student_id
       WHERE s.dojo_id = ? AND (p.status = 'overdue' OR (p.status = 'pending' AND p.due_date < ?))
       ORDER BY p.due_date ASC`,
      [this.dojoId, today]
    );
  }

  markPaid(paymentId: number, amountPaid: number): void {
    const today = new Date().toISOString().split('T')[0];
    this.dbService.run(
      `UPDATE payments SET amount_paid = ?, paid_date = ?, status = 'paid' WHERE id = ?`,
      [amountPaid, today, paymentId]
    );
  }

  generateMonthlyFees(monthYear: string): number {
    const defaultDueDay = this.getSettingValue('default_due_day') || '5';
    const dueDate = `${monthYear}-${defaultDueDay.padStart(2, '0')}`;

    const studentsWithPlans = this.dbService.query<{
      student_id: number; monthly_amount: number;
    }>(
      `SELECT sfp.student_id, fp.monthly_amount
       FROM student_fee_plan sfp
       JOIN fee_plans fp ON fp.id = sfp.fee_plan_id
       JOIN students s ON s.id = sfp.student_id
       WHERE s.is_active = 1 AND s.dojo_id = ?`,
      [this.dojoId]
    );

    let generated = 0;
    for (const sp of studentsWithPlans) {
      const existing = this.dbService.query<{ id: number }>(
        'SELECT id FROM payments WHERE student_id = ? AND month_year = ?',
        [sp.student_id, monthYear]
      );
      if (existing.length === 0) {
        this.dbService.run(
          `INSERT INTO payments (student_id, month_year, amount_due, amount_paid, due_date, status)
           VALUES (?, ?, ?, 0, ?, 'pending')`,
          [sp.student_id, monthYear, sp.monthly_amount, dueDate]
        );
        generated++;
      }
    }
    return generated;
  }

  updateOverdueStatuses(): void {
    const today = new Date().toISOString().split('T')[0];
    this.dbService.run(
      `UPDATE payments SET status = 'overdue'
       WHERE status = 'pending' AND due_date < ?
       AND student_id IN (SELECT id FROM students WHERE dojo_id = ?)`,
      [today, this.dojoId]
    );
  }

  getOverdueCount(): number {
    const today = new Date().toISOString().split('T')[0];
    const result = this.dbService.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM payments p
       JOIN students s ON s.id = p.student_id
       WHERE s.dojo_id = ? AND (p.status = 'overdue' OR (p.status = 'pending' AND p.due_date < ?))`,
      [this.dojoId, today]
    );
    return result[0]?.count || 0;
  }

  getOverdueTotalAmount(): number {
    const today = new Date().toISOString().split('T')[0];
    const result = this.dbService.query<{ total: number }>(
      `SELECT COALESCE(SUM(p.amount_due - p.amount_paid), 0) as total FROM payments p
       JOIN students s ON s.id = p.student_id
       WHERE s.dojo_id = ? AND (p.status = 'overdue' OR (p.status = 'pending' AND p.due_date < ?))`,
      [this.dojoId, today]
    );
    return result[0]?.total || 0;
  }

  getMonthlyCollection(monthYear: string): number {
    const result = this.dbService.query<{ total: number }>(
      `SELECT COALESCE(SUM(p.amount_paid), 0) as total FROM payments p
       JOIN students s ON s.id = p.student_id
       WHERE p.month_year = ? AND s.dojo_id = ?`,
      [monthYear, this.dojoId]
    );
    return result[0]?.total || 0;
  }

  private getSettingValue(key: string): string | null {
    const result = this.dbService.query<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    return result[0]?.value || null;
  }
}
