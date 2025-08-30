import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth'; // Adjust path as needed
import { ProfileService } from '../../shared/profile/profile.service';
import { user } from '@angular/fire/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="register-container">
      <h2 class="register-title">📝 Register</h2>

      <form (ngSubmit)="onRegister()" #registerForm="ngForm">
        <!-- Username -->
        <div class="form-group">
          <label for="username">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            [(ngModel)]="username"
            required
            placeholder="Choose a username"
          />
        </div>

        <!-- Email -->
        <div class="form-group">
          <label for="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            [(ngModel)]="email"
            required
            placeholder="Enter your email"
          />
        </div>

        <!-- Password -->
        <div class="form-group">
          <label for="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            [(ngModel)]="password"
            required
            placeholder="Create a password"
            minlength="6"
          />
          <small class="password-hint">Password must be at least 6 characters long</small>
        </div>

        <!-- Confirm Password -->
        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            [(ngModel)]="confirmPassword"
            required
            placeholder="Confirm your password"
          />
        </div>

        <!-- Error Message -->
        <div *ngIf="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <!-- Success Message -->
        <div *ngIf="successMessage" class="success-message">
          {{ successMessage }}
        </div>

        <!-- Submit Button -->
        <button 
          type="submit" 
          [disabled]="!registerForm.form.valid || isLoading" 
          class="register-button">
          {{ isLoading ? 'Creating Account...' : 'Register' }}
        </button>
      </form>


<button
  type="button"
  (click)="onGoogleRegister()"
  [disabled]="isLoading"
  class="google-button">
  <span class="google-icon">🔑</span> Register with Google
</button>

      <p class="login-text">
        Already have an account? <a href="/login">Login</a>
      </p>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #fdfcf9;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .register-container {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
    }

    .register-title {
      text-align: center;
      margin-bottom: 1.5rem;
      font-size: 1.8rem;
      font-weight: 700;
      color: #2e2e2e;
    }

    .form-group {
      margin-bottom: 1.2rem;
    }

    label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #444;
    }

    input {
      width: 100%;
      padding: 0.8rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
      outline: none;
      transition: border 0.3s;
      box-sizing: border-box;
    }

    input:focus {
      border-color: #F7C843;
      box-shadow: 0 0 0 2px rgba(247,200,67,0.2);
    }

    .password-hint {
      color: #666;
      font-size: 0.8rem;
      margin-top: 0.3rem;
      display: block;
    }

    .error-message {
      background: #fee;
      color: #c33;
      padding: 0.8rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      font-size: 0.9rem;
      border: 1px solid #fcc;
    }

    .success-message {
      background: #efe;
      color: #363;
      padding: 0.8rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      font-size: 0.9rem;
      border: 1px solid #cfc;
    }

    .register-button, .google-button {
      width: 100%;
      padding: 0.9rem;
      font-size: 1rem;
      font-weight: bold;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.3s;
      margin-bottom: 1rem;
    }

    .register-button {
      background: #F7C843;
      color: #2e2e2e;
    }

    .register-button:disabled {
      background: #ddd;
      cursor: not-allowed;
    }

    .register-button:hover:not(:disabled) {
      background: #e5b935;
    }

    .google-button {
      background: #fff;
      color: #333;
      border: 2px solid #ddd;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .google-button:hover:not(:disabled) {
      background: #f8f8f8;
      border-color: #ccc;
    }

    .google-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .google-icon {
      font-size: 1.2rem;
    }

    .login-text {
      text-align: center;
      margin-top: 1rem;
      font-size: 0.9rem;
      color: #555;
    }

    .login-text a {
      color: #F7C843;
      text-decoration: none;
      font-weight: bold;
    }
  `]
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private profileService = inject(ProfileService); // ✅ inject


  username: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;

  async onRegister() {
    // Reset messages
    this.errorMessage = '';
    this.successMessage = '';

    // Validation
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match!';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long.';
      return;
    }

    this.isLoading = true;

    try {
      const userCredential = await this.authService.emailRegister(this.email, this.password);
      console.log('Registration successful:', userCredential);
      
      // Optionally update the user's display name with the username
      if (userCredential.user && this.username) {
        // Note: You'll need to import updateProfile from Firebase Auth
        // import { updateProfile } from '@angular/fire/auth';
        // await updateProfile(userCredential.user, { displayName: this.username });
        await this.profileService.createOrUpdateProfile(userCredential.user, {
          displayName: this.username || 'Anonymous',
        });
      }

      this.successMessage = 'Account created successfully! Redirecting...';
      
      // Redirect after a short delay
      setTimeout(() => {
        this.router.navigate(['/stories']); // Adjust route as needed
      }, 2000);

    } catch (error: any) {
      console.error('Registration error:', error);
      this.errorMessage = this.getErrorMessage(error.code);
    } finally {
      this.isLoading = false;
    }
  }


// Implement onGoogleRegister in RegisterComponent:
async onGoogleRegister() {
  this.isLoading = true;
  this.errorMessage = '';
  try {
    await this.authService.googleLogin();
    console.log('Google registration successful!');
    this.router.navigate(['/stories']); // Adjust as needed
  } catch (error: any) {
    console.error('Google registration error:', error);
    this.errorMessage = 'Google registration failed. Please try again.';
  } finally {
    this.isLoading = false;
  }
}


  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/invalid-email':
        return 'Invalid email address.';
      case 'auth/operation-not-allowed':
        return 'Email/password accounts are not enabled.';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger password.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email using a different sign-in method.';
      default:
        return 'Registration failed. Please try again.';
    }
  }
}