import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subscription } from 'rxjs';
import { StudentService } from '../../../core/services/student.service';
import { Student, BELT_RANKS } from '../../../core/models/student.model';
import { StudentFormComponent } from '../student-form/student-form.component';
import { DojoService } from '../../../core/services/dojo.service';

@Component({
  selector: 'app-student-list',
  templateUrl: './student-list.component.html',
  styleUrls: ['./student-list.component.scss']
})
export class StudentListComponent implements OnInit, OnDestroy {
  students: Student[] = [];
  filteredStudents: Student[] = [];
  searchTerm = '';
  showInactive = false;
  isMobile = false;
  displayedColumns = ['name', 'belt_rank', 'phone', 'status', 'actions'];
  private dojoSub!: Subscription;

  constructor(
    private studentService: StudentService,
    private dialog: MatDialog,
    private breakpointObserver: BreakpointObserver,
    private dojoService: DojoService
  ) {}

  ngOnInit() {
    this.breakpointObserver.observe([Breakpoints.Handset]).subscribe(result => {
      this.isMobile = result.matches;
    });
    this.dojoSub = this.dojoService.getSelectedDojo$().subscribe(() => {
      this.loadStudents();
    });
  }

  ngOnDestroy() {
    this.dojoSub.unsubscribe();
  }

  loadStudents() {
    this.students = this.showInactive ? this.studentService.getAll() : this.studentService.getActive();
    this.applyFilter();
  }

  applyFilter() {
    if (!this.searchTerm.trim()) {
      this.filteredStudents = this.students;
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredStudents = this.students.filter(s =>
        s.name.toLowerCase().includes(term) || s.phone.includes(term)
      );
    }
  }

  addStudent() {
    const dialogRef = this.dialog.open(StudentFormComponent, {
      width: this.isMobile ? '100vw' : '500px',
      maxWidth: this.isMobile ? '100vw' : '500px',
      height: this.isMobile ? '100vh' : 'auto',
      panelClass: this.isMobile ? 'mobile-dialog' : '',
      data: { student: null }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadStudents();
    });
  }

  editStudent(student: Student) {
    const dialogRef = this.dialog.open(StudentFormComponent, {
      width: this.isMobile ? '100vw' : '500px',
      maxWidth: this.isMobile ? '100vw' : '500px',
      height: this.isMobile ? '100vh' : 'auto',
      panelClass: this.isMobile ? 'mobile-dialog' : '',
      data: { student }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadStudents();
    });
  }

  toggleActive(student: Student) {
    this.studentService.toggleActive(student.id!, !student.is_active);
    this.loadStudents();
  }

  getBeltColor(rank: string): string {
    const colors: Record<string, string> = {
      'White': '#f5f5f5', 'Yellow': '#ffeb3b', 'Orange': '#ff9800',
      'Green': '#4caf50', 'Blue': '#2196f3', 'Purple': '#9c27b0',
      'Brown': '#795548', 'Black': '#212121'
    };
    return colors[rank] || '#e0e0e0';
  }

  getBeltTextColor(rank: string): string {
    return ['White', 'Yellow'].includes(rank) ? '#333' : '#fff';
  }
}
