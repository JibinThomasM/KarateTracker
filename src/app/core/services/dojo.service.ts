import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { Dojo } from '../models/dojo.model';

const SELECTED_DOJO_KEY = 'karate_tracker_selected_dojo';

@Injectable({ providedIn: 'root' })
export class DojoService {
  private selectedDojoId$ = new BehaviorSubject<string>('');
  private initialized = false;

  constructor(private afs: AngularFirestore) {}

  async initSelection(): Promise<void> {
    if (this.initialized) return;
    const dojos = await this.getAll();
    const saved = localStorage.getItem(SELECTED_DOJO_KEY);

    if (saved && dojos.some(d => d.id === saved)) {
      this.selectedDojoId$.next(saved);
    } else if (dojos.length > 0) {
      this.selectDojo(dojos[0].id!);
    }
    this.initialized = true;
  }

  getSelectedDojoId(): string {
    return this.selectedDojoId$.value;
  }

  getSelectedDojo$() {
    return this.selectedDojoId$.asObservable();
  }

  selectDojo(id: string): void {
    this.selectedDojoId$.next(id);
    localStorage.setItem(SELECTED_DOJO_KEY, id);
  }

  async getAll(): Promise<Dojo[]> {
    const snapshot = await firstValueFrom(
      this.afs.collection<Dojo>('dojos', ref => ref.where('isActive', '==', true)).get()
    );
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getAllIncludingInactive(): Promise<Dojo[]> {
    const snapshot = await firstValueFrom(
      this.afs.collection<Dojo>('dojos').get()
    );
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getById(id: string): Promise<Dojo | undefined> {
    const doc = await firstValueFrom(this.afs.doc<Dojo>(`dojos/${id}`).get());
    return doc.exists ? { id: doc.id, ...doc.data()! } : undefined;
  }

  async add(dojo: Omit<Dojo, 'id'>): Promise<void> {
    await this.afs.collection('dojos').add(dojo);
    if (!this.selectedDojoId$.value) {
      const all = await this.getAll();
      if (all.length > 0) {
        this.selectDojo(all[all.length - 1].id!);
      }
    }
  }

  async update(dojo: Dojo): Promise<void> {
    const { id, ...data } = dojo;
    await this.afs.doc(`dojos/${id}`).update(data);
  }

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    await this.afs.doc(`dojos/${id}`).update({ isActive });
  }

  async delete(id: string): Promise<void> {
    const batch = this.afs.firestore.batch();

    // Delete related students and their data
    const students = await firstValueFrom(
      this.afs.collection('students', ref => ref.where('dojoId', '==', id)).get()
    );
    for (const studentDoc of students.docs) {
      // Delete attendance for this student
      const attendance = await firstValueFrom(
        this.afs.collection('attendance', ref => ref.where('studentId', '==', studentDoc.id)).get()
      );
      attendance.docs.forEach(doc => batch.delete(doc.ref));

      // Delete payments for this student
      const payments = await firstValueFrom(
        this.afs.collection('payments', ref => ref.where('studentId', '==', studentDoc.id)).get()
      );
      payments.docs.forEach(doc => batch.delete(doc.ref));

      batch.delete(studentDoc.ref);
    }

    // Delete fee plans
    const feePlans = await firstValueFrom(
      this.afs.collection('feePlans', ref => ref.where('dojoId', '==', id)).get()
    );
    feePlans.docs.forEach(doc => batch.delete(doc.ref));

    // Delete the dojo itself
    batch.delete(this.afs.doc(`dojos/${id}`).ref);

    await batch.commit();

    if (this.selectedDojoId$.value === id) {
      const remaining = await this.getAll();
      if (remaining.length > 0) {
        this.selectDojo(remaining[0].id!);
      } else {
        this.selectedDojoId$.next('');
        localStorage.removeItem(SELECTED_DOJO_KEY);
      }
    }
  }
}
