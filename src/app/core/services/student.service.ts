import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { firstValueFrom } from 'rxjs';
import { DojoService } from './dojo.service';
import { Student } from '../models/student.model';
import { FeePlan } from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class StudentService {
  constructor(private afs: AngularFirestore, private dojoService: DojoService) {}

  private get dojoId(): string {
    return this.dojoService.getSelectedDojoId();
  }

  async getAll(): Promise<Student[]> {
    const snapshot = await firstValueFrom(
      this.afs.collection<Student>('students', ref =>
        ref.where('dojoId', '==', this.dojoId)
      ).get()
    );
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getActive(): Promise<Student[]> {
    const snapshot = await firstValueFrom(
      this.afs.collection<Student>('students', ref =>
        ref.where('dojoId', '==', this.dojoId).where('isActive', '==', true)
      ).get()
    );
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getById(id: string): Promise<Student | undefined> {
    const doc = await firstValueFrom(this.afs.doc<Student>(`students/${id}`).get());
    return doc.exists ? { id: doc.id, ...doc.data()! } : undefined;
  }

  async add(student: Omit<Student, 'id'>): Promise<void> {
    await this.afs.collection('students').add({ ...student, dojoId: this.dojoId });
  }

  async update(student: Student): Promise<void> {
    const { id, ...data } = student;
    await this.afs.doc(`students/${id}`).update(data);
  }

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    await this.afs.doc(`students/${id}`).update({ isActive });
  }

  async search(term: string): Promise<Student[]> {
    // Firestore doesn't support LIKE queries, so we filter client-side
    const all = await this.getAll();
    const lower = term.toLowerCase();
    return all.filter(s => s.name.toLowerCase().includes(lower) || s.phone.includes(term));
  }

  async getCount(): Promise<number> {
    const active = await this.getActive();
    return active.length;
  }

  async getFeePlan(studentId: string): Promise<{ feePlanId: string; planName: string; monthlyAmount: number } | undefined> {
    const student = await this.getById(studentId);
    if (!student?.feePlanId) return undefined;
    const doc = await firstValueFrom(this.afs.doc<FeePlan>(`feePlans/${student.feePlanId}`).get());
    if (!doc.exists) return undefined;
    const plan = doc.data()!;
    return { feePlanId: doc.id, planName: plan.name, monthlyAmount: plan.monthlyAmount };
  }

  async assignFeePlan(studentId: string, feePlanId: string): Promise<void> {
    await this.afs.doc(`students/${studentId}`).update({ feePlanId });
  }
}
