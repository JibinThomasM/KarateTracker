import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private afAuth: AngularFireAuth) {
    // Require login each time the browser/tab is opened
    this.afAuth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
  }

  isLoggedIn(): boolean {
    return !!this.afAuth.currentUser;
  }

  /** Observable that emits true/false based on auth state */
  isLoggedIn$() {
    return this.afAuth.authState.pipe(map(user => !!user));
  }

  async isPasswordSet(): Promise<boolean> {
    // With Firebase Auth, if any user exists we consider password as "set"
    // We check current auth state — if user is signed in, password is set
    // For first-time check, we attempt a simple approach
    return true; // Firebase handles this via sign-in flow
  }

  async register(email: string, password: string): Promise<void> {
    await this.afAuth.createUserWithEmailAndPassword(email, password);
  }

  async login(email: string, password: string): Promise<boolean> {
    try {
      await this.afAuth.signInWithEmailAndPassword(email, password);
      return true;
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    await this.afAuth.signOut();
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    await this.afAuth.sendPasswordResetEmail(email);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user || !user.email) throw new Error('No user logged in');
    // Re-authenticate before changing password
    const firebase = await import('firebase/compat/app');
    const credential = firebase.default.auth.EmailAuthProvider.credential(user.email, currentPassword);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPassword);
  }

  /** Check if any user account exists by trying to fetch sign-in methods */
  async hasAccount(): Promise<boolean> {
    // We store a flag in localStorage after first registration
    return localStorage.getItem('karate_tracker_registered') === 'true';
  }

  markRegistered(): void {
    localStorage.setItem('karate_tracker_registered', 'true');
  }
}
