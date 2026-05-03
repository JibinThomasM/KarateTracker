import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DatabaseService } from './database.service';
import { Dojo } from '../models/dojo.model';

const SELECTED_DOJO_KEY = 'karate_tracker_selected_dojo';

@Injectable({ providedIn: 'root' })
export class DojoService {
  private selectedDojoId$ = new BehaviorSubject<number>(0);

  constructor(private dbService: DatabaseService) {}

  /** Call after DB is initialized to load the saved selection */
  initSelection(): void {
    const saved = localStorage.getItem(SELECTED_DOJO_KEY);
    const dojos = this.getAll();

    if (saved && dojos.some(d => d.id === parseInt(saved, 10))) {
      this.selectedDojoId$.next(parseInt(saved, 10));
    } else if (dojos.length > 0) {
      this.selectDojo(dojos[0].id!);
    }
  }

  getSelectedDojoId(): number {
    return this.selectedDojoId$.value;
  }

  getSelectedDojo$() {
    return this.selectedDojoId$.asObservable();
  }

  selectDojo(id: number): void {
    this.selectedDojoId$.next(id);
    localStorage.setItem(SELECTED_DOJO_KEY, id.toString());
  }

  getAll(): Dojo[] {
    return this.dbService.query<Dojo>('SELECT * FROM dojos WHERE is_active = 1 ORDER BY name');
  }

  getAllIncludingInactive(): Dojo[] {
    return this.dbService.query<Dojo>('SELECT * FROM dojos ORDER BY name');
  }

  getById(id: number): Dojo | undefined {
    const results = this.dbService.query<Dojo>('SELECT * FROM dojos WHERE id = ?', [id]);
    return results[0];
  }

  add(dojo: Omit<Dojo, 'id'>): void {
    this.dbService.run(
      'INSERT INTO dojos (name, location, phone, is_active) VALUES (?, ?, ?, ?)',
      [dojo.name, dojo.location, dojo.phone, dojo.is_active]
    );
    // If this is the first dojo (no selection yet), select it
    if (this.selectedDojoId$.value === 0) {
      const all = this.getAll();
      if (all.length > 0) {
        this.selectDojo(all[all.length - 1].id!);
      }
    }
  }

  update(dojo: Dojo): void {
    this.dbService.run(
      'UPDATE dojos SET name = ?, location = ?, phone = ?, is_active = ? WHERE id = ?',
      [dojo.name, dojo.location, dojo.phone, dojo.is_active, dojo.id]
    );
  }

  toggleActive(id: number, isActive: boolean): void {
    this.dbService.run('UPDATE dojos SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  }

  delete(id: number): void {
    // Delete related data first
    this.dbService.run(
      `DELETE FROM payments WHERE student_id IN (SELECT id FROM students WHERE dojo_id = ?)`, [id]
    );
    this.dbService.run(
      `DELETE FROM attendance WHERE student_id IN (SELECT id FROM students WHERE dojo_id = ?)`, [id]
    );
    this.dbService.run(
      `DELETE FROM student_fee_plan WHERE student_id IN (SELECT id FROM students WHERE dojo_id = ?)`, [id]
    );
    this.dbService.run('DELETE FROM fee_plans WHERE dojo_id = ?', [id]);
    this.dbService.run('DELETE FROM students WHERE dojo_id = ?', [id]);
    this.dbService.run('DELETE FROM dojos WHERE id = ?', [id]);

    // If the deleted dojo was selected, switch to another
    if (this.selectedDojoId$.value === id) {
      const remaining = this.getAll();
      if (remaining.length > 0) {
        this.selectDojo(remaining[0].id!);
      } else {
        this.selectedDojoId$.next(0);
        localStorage.removeItem(SELECTED_DOJO_KEY);
      }
    }
  }
}
