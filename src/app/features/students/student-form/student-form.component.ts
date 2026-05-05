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
  selectedFeePlanId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private studentService: StudentService,
    private paymentService: PaymentService,
    private dialogRef: MatDialogRef<StudentFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { student: Student | null }
  ) {}

  async ngOnInit() {
    this.isEdit = !!this.data.student;

    this.form = this.fb.group({
      name: [this.data.student?.name || '', Validators.required],
      beltRank: [this.data.student?.beltRank || 'White', Validators.required],
      phone: [this.data.student?.phone || '', Validators.required],
      whatsappNumber: [this.data.student?.whatsappNumber || ''],
      joinDate: [this.data.student?.joinDate || new Date().toISOString().split('T')[0], Validators.required],
      isActive: [this.data.student?.isActive ?? true]
    });

    this.feePlans = await this.paymentService.getFeePlans();

    if (this.isEdit && this.data.student?.id) {
      const plan = await this.studentService.getFeePlan(this.data.student.id);
      this.selectedFeePlanId = plan?.feePlanId || null;
    }
  }

  copyPhoneToWhatsapp() {
    if (!this.form.get('whatsappNumber')?.value) {
      this.form.patchValue({ whatsappNumber: this.form.get('phone')?.value });
    }
  }

  async save() {
    if (this.form.invalid) return;

    const studentData = this.form.value;

    if (this.isEdit && this.data.student?.id) {
      await this.studentService.update({ ...studentData, id: this.data.student.id });
      if (this.selectedFeePlanId) {
        await this.studentService.assignFeePlan(this.data.student.id, this.selectedFeePlanId);
      }
    } else {
      await this.studentService.add(studentData);
      if (this.selectedFeePlanId) {
        const allStudents = await this.studentService.getAll();
        const newStudent = allStudents[allStudents.length - 1];
        if (newStudent) {
          await this.studentService.assignFeePlan(newStudent.id!, this.selectedFeePlanId);
        }
      }
    }

    this.dialogRef.close(true);
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
