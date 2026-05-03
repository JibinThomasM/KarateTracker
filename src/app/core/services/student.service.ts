import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { DojoService } from './dojo.service';
import { Student } from '../models/student.model';

@Injectable({ providedIn: 'root' })
export class StudentService {
  constructor(private dbService: DatabaseService, private dojoService: DojoService) {}

  private get dojoId(): number {
    return this.dojoService.getSelectedDojoId();
  }

  getAll(): Student[] {
    return this.dbService.query<Student>('SELECT * FROM students WHERE dojo_id = ? ORDER BY name', [this.dojoId]);
  }

  getActive(): Student[] {
    return this.dbService.query<Student>('SELECT * FROM students WHERE is_active = 1 AND dojo_id = ? ORDER BY name', [this.dojoId]);
  }

  getById(id: number): Student | undefined {
    const results = this.dbService.query<Student>('SELECT * FROM students WHERE id = ? AND dojo_id = ?', [id, this.dojoId]);
    return results[0];
  }

  add(student: Omit<Student, 'id'>): void {
    this.dbService.run(
      `INSERT INTO students (name, belt_rank, phone, whatsapp_number, join_date, is_active, dojo_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [student.name, student.belt_rank, student.phone, student.whatsapp_number, student.join_date, student.is_active, this.dojoId]
    );
  }

  update(student: Student): void {
    this.dbService.run(
      `UPDATE students SET name = ?, belt_rank = ?, phone = ?, whatsapp_number = ?, join_date = ?, is_active = ?
       WHERE id = ? AND dojo_id = ?`,
      [student.name, student.belt_rank, student.phone, student.whatsapp_number, student.join_date, student.is_active, student.id, this.dojoId]
    );
  }

  toggleActive(id: number, isActive: boolean): void {
    this.dbService.run('UPDATE students SET is_active = ? WHERE id = ? AND dojo_id = ?', [isActive ? 1 : 0, id, this.dojoId]);
  }

  search(term: string): Student[] {
    const like = `%${term}%`;
    return this.dbService.query<Student>(
      'SELECT * FROM students WHERE dojo_id = ? AND (name LIKE ? OR phone LIKE ?) ORDER BY name',
      [this.dojoId, like, like]
    );
  }

  getCount(): number {
    const result = this.dbService.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM students WHERE is_active = 1 AND dojo_id = ?', [this.dojoId]
    );
    return result[0]?.count || 0;
  }

  getFeePlan(studentId: number): { fee_plan_id: number; plan_name: string; monthly_amount: number } | undefined {
    const results = this.dbService.query<{ fee_plan_id: number; plan_name: string; monthly_amount: number }>(
      `SELECT sfp.fee_plan_id, fp.name as plan_name, fp.monthly_amount
       FROM student_fee_plan sfp
       JOIN fee_plans fp ON fp.id = sfp.fee_plan_id
       WHERE sfp.student_id = ?`,
      [studentId]
    );
    return results[0];
  }

  assignFeePlan(studentId: number, feePlanId: number): void {
    this.dbService.run(
      'INSERT OR REPLACE INTO student_fee_plan (student_id, fee_plan_id) VALUES (?, ?)',
      [studentId, feePlanId]
    );
  }
}
