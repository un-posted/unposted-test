import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth'; // Adjust path as needed

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <h2 class="login-title">🔑 Login</h2>

      <form (ngSubmit)="onLogin()" #loginForm="ngForm">
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
            placeholder="Enter your password"
          />
        </div>

        <!-- Error Message -->
        <div *ngIf="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <!-- Submit Button -->
        <button 
          type="submit" 
          [disabled]="!loginForm.form.valid || isLoading" 
          class="login-button">
          {{ isLoading ? 'Logging in...' : 'Login' }}
        </button>
      </form>

      <!-- Google Sign In Button -->
      <button
        type="button"
        (click)="onGoogleLogin()"
        [disabled]="isLoading"
        class="google-button">
        <span class="google-icon">🔑</span> Sign in with Google
      </button>

      <p class="signup-text">
        Don't have an account? <a href="/register">Sign up</a>
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

    .login-container {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
    }

    .login-title {
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

    .error-message {
      background: #fee;
      color: #c33;
      padding: 0.8rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      font-size: 0.9rem;
      border: 1px solid #fcc;
    }

    .login-button, .google-button {
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

    .login-button {
      background: #F7C843;
      color: #2e2e2e;
    }

    .login-button:disabled {
      background: #ddd;
      cursor: not-allowed;
    }

    .login-button:hover:not(:disabled) {
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

    .signup-text {
      text-align: center;
      margin-top: 1rem;
      font-size: 0.9rem;
      color: #555;
    }

    .signup-text a {
      color: #F7C843;
      text-decoration: none;
      font-weight: bold;
    }
  `]
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  email: string = '';
  password: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;

  async onLogin() {
    if (!this.email || !this.password) return;

    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.emailLogin(this.email, this.password);
      console.log('Login successful!');
      // Redirect to dashboard or home page
      
      this.router.navigate(['/stories']); // Adjust route as needed
    } catch (error: any) {
      console.error('Login error:', error);
      this.errorMessage = this.getErrorMessage(error.code);
    } finally {
      this.isLoading = false;
    }
  }


  // Google login method
  async onGoogleLogin() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      await this.authService.googleLogin();
      console.log('Google login successful!');
      // Redirect to the dashboard or home page
      this.router.navigate(['/stories']);
    } catch (error: any) {
      console.error('Google login error:', error);
      this.errorMessage = 'Google login failed. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }



  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/invalid-email':
        return 'Invalid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      default:
        return 'Login failed. Please try again.';
    }
  }
}