import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  error = '';
  loading = false;
  resetMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    // Check if already logged in
    const loggedIn = await this.authService.isLoggedIn$().toPromise();
    if (loggedIn) {
      this.router.navigate(['/dashboard']);
    }
  }

  private isEmailAllowed(email: string): boolean {
    const allowed = environment.allowedEmails;
    if (!allowed || allowed.length === 0) return true; // No restriction if list is empty
    return allowed.map(e => e.toLowerCase()).includes(email.toLowerCase());
  }

  async onSubmit() {
    this.error = '';
    this.loading = true;

    try {
      if (!this.email || !this.email.includes('@')) {
        this.error = 'Please enter a valid email';
        this.loading = false;
        return;
      }
      if (!this.password) {
        this.error = 'Please enter a password';
        this.loading = false;
        return;
      }

      // Check against allowed emails list
      if (!this.isEmailAllowed(this.email)) {
        this.error = 'Access denied. Your email is not authorized to use this app.';
        this.loading = false;
        return;
      }

      const success = await this.authService.login(this.email, this.password);
      if (success) {
        this.router.navigate(['/dashboard']);
      } else {
        this.error = 'Incorrect email or password';
      }
    } catch (e: any) {
      this.error = e.message || 'An error occurred. Please try again.';
    }
    this.loading = false;
  }

  async forgotPassword() {
    if (!this.email || !this.email.includes('@')) {
      this.error = 'Please enter your email address first';
      return;
    }
    this.loading = true;
    this.error = '';
    this.resetMessage = '';
    try {
      await this.authService.sendPasswordResetEmail(this.email);
      this.resetMessage = 'Password reset email sent. Check your inbox.';
    } catch (e: any) {
      this.error = e.message || 'Failed to send reset email';
    }
    this.loading = false;
  }
}
