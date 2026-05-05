import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { firstValueFrom } from 'rxjs';
import { DojoService } from './dojo.service';
import { SettingsService } from './settings.service';
import { StudentService } from './student.service';
import { Payment, PaymentRecord, FeePlan } from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  constructor(
    private afs: AngularFirestore,
    private dojoService: DojoService,
    private settingsService: SettingsService,
    private studentService: StudentService
  ) {}

  private get dojoId(): string {
    return this.dojoService.getSelectedDojoId();
  }

  // Fee Plans
  async getFeePlans(): Promise<FeePlan[]> {
    const snapshot = await firstValueFrom(
      this.afs.collection<FeePlan>('feePlans', ref =>
        ref.where('dojoId', '==', this.dojoId)
      ).get()
    );
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
  }

  async addFeePlan(plan: Omit<FeePlan, 'id'>): Promise<void> {
    await this.afs.collection('feePlans').add({ ...plan, dojoId: this.dojoId });
  }

  async updateFeePlan(plan: FeePlan): Promise<void> {
    const { id, ...data } = plan;
    await this.afs.doc(`feePlans/${id}`).update(data);
  }

  async deleteFeePlan(id: string): Promise<void> {
    await this.afs.doc(`feePlans/${id}`).delete();
  }

  // Payments
  async getPayments(monthYear?: string, status?: string): Promise<PaymentRecord[]> {
    let results: PaymentRecord[];

    if (monthYear) {
      const snapshot = await firstValueFrom(
        this.afs.collection<Payment>('payments', ref => {
          let q = ref.where('dojoId', '==', this.dojoId).where('monthYear', '==', monthYear);
          if (status) q = q.where('status', '==', status);
          return q;
        }).get()
      );
      results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentRecord));
    } else {
      const snapshot = await firstValueFrom(
        this.afs.collection<Payment>('payments', ref => {
          let q = ref.where('dojoId', '==', this.dojoId);
          if (status) q = q.where('status', '==', status);
          return q;
        }).get()
      );
      results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentRecord));
    }

    return results.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
  }

  async getOverduePayments(): Promise<PaymentRecord[]> {
    const today = new Date().toISOString().split('T')[0];
    const snapshot = await firstValueFrom(
      this.afs.collection<Payment>('payments', ref =>
        ref.where('dojoId', '==', this.dojoId)
           .where('status', 'in', ['overdue', 'pending'])
      ).get()
    );
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as PaymentRecord))
      .filter(p => p.status === 'overdue' || (p.status === 'pending' && p.dueDate < today))
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  }

  async markPaid(paymentId: string, amountPaid: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    await this.afs.doc(`payments/${paymentId}`).update({
      amountPaid,
      paidDate: today,
      status: 'paid'
    });
  }

  async generateMonthlyFees(monthYear: string): Promise<number> {
    await this.settingsService.loadSettings();
    const defaultDueDay = String(this.settingsService.get('default_due_day') || '5');
    const dueDate = `${monthYear}-${defaultDueDay.padStart(2, '0')}`;

    // Get active students with fee plans
    const students = await this.studentService.getActive();
    const studentsWithPlans: { student: any; plan: FeePlan }[] = [];

    for (const student of students) {
      if (student.feePlanId) {
        const planDoc = await firstValueFrom(this.afs.doc<FeePlan>(`feePlans/${student.feePlanId}`).get());
        if (planDoc.exists) {
          studentsWithPlans.push({ student, plan: { id: planDoc.id, ...planDoc.data()! } });
        }
      }
    }

    let generated = 0;
    const batch = this.afs.firestore.batch();

    for (const { student, plan } of studentsWithPlans) {
      const docId = `${student.id}_${monthYear}`;
      const existing = await firstValueFrom(this.afs.doc(`payments/${docId}`).get());
      if (!existing.exists) {
        const ref = this.afs.doc(`payments/${docId}`).ref;
        batch.set(ref, {
          studentId: student.id,
          dojoId: this.dojoId,
          monthYear,
          amountDue: plan.monthlyAmount,
          amountPaid: 0,
          dueDate,
          status: 'pending',
          studentName: student.name,
          whatsappNumber: student.whatsappNumber || ''
        });
        generated++;
      }
    }

    if (generated > 0) await batch.commit();
    return generated;
  }

  async updateOverdueStatuses(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const snapshot = await firstValueFrom(
      this.afs.collection<Payment>('payments', ref =>
        ref.where('dojoId', '==', this.dojoId).where('status', '==', 'pending')
      ).get()
    );

    const batch = this.afs.firestore.batch();
    let count = 0;
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.dueDate < today) {
        batch.update(doc.ref, { status: 'overdue' });
        count++;
      }
    });
    if (count > 0) await batch.commit();
  }

  async getOverdueCount(): Promise<number> {
    const overdue = await this.getOverduePayments();
    return overdue.length;
  }

  async getOverdueTotalAmount(): Promise<number> {
    const overdue = await this.getOverduePayments();
    return overdue.reduce((sum, p) => sum + (p.amountDue - p.amountPaid), 0);
  }

  async getMonthlyCollection(monthYear: string): Promise<number> {
    const snapshot = await firstValueFrom(
      this.afs.collection<Payment>('payments', ref =>
        ref.where('dojoId', '==', this.dojoId).where('monthYear', '==', monthYear)
      ).get()
    );
    return snapshot.docs.reduce((sum, doc) => sum + (doc.data().amountPaid || 0), 0);
  }
}
