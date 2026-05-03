import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { StudentService } from '../../../core/services/student.service';
import { PaymentService } from '../../../core/services/payment.service';
import { Student, BELT_RANKS } from '../../../core/models/student.model';
import { FeePlan } from '../../../core/models/payment.model';

@Component({
  selector: 'app-student-form',
  templateUrl: './student-form.component.html',
  styleUrls: ['./student-form.component.scss']
})
export class StudentFormComponent implements OnInit {
  form!: FormGroup;
  isEdit = false;
  beltRanks = BELT_RANKS;
  feePlans: FeePlan[] = [];
  selectedFeePlanId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private studentService: StudentService,
    private paymentService: PaymentService,
    private dialogRef: MatDialogRef<StudentFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { student: Student | null }
  ) {}

  ngOnInit() {
    this.isEdit = !!this.data.student;
    this.feePlans = this.paymentService.getFeePlans();

    this.form = this.fb.group({
      name: [this.data.student?.name || '', Validators.required],
      belt_rank: [this.data.student?.belt_rank || 'White', Validators.required],
      phone: [this.data.student?.phone || '', Validators.required],
      whatsapp_number: [this.data.student?.whatsapp_number || ''],
      join_date: [this.data.student?.join_date || new Date().toISOString().split('T')[0], Validators.required],
      is_active: [this.data.student?.is_active ?? 1]
    });

    if (this.isEdit && this.data.student?.id) {
      const plan = this.studentService.getFeePlan(this.data.student.id);
      this.selectedFeePlanId = plan?.fee_plan_id || null;
    }
  }

  copyPhoneToWhatsapp() {
    if (!this.form.get('whatsapp_number')?.value) {
      this.form.patchValue({ whatsapp_number: this.form.get('phone')?.value });
    }
  }

  save() {
    if (this.form.invalid) return;

    const studentData = this.form.value;

    if (this.isEdit && this.data.student?.id) {
      this.studentService.update({ ...studentData, id: this.data.student.id });
      if (this.selectedFeePlanId) {
        this.studentService.assignFeePlan(this.data.student.id, this.selectedFeePlanId);
      }
    } else {
      this.studentService.add(studentData);
      // Get the newly created student's ID
      const allStudents = this.studentService.getAll();
      const newStudent = allStudents[allStudents.length - 1];
      if (newStudent && this.selectedFeePlanId) {
        this.studentService.assignFeePlan(newStudent.id!, this.selectedFeePlanId);
      }
    }

    this.dialogRef.close(true);
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
