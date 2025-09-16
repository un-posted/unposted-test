import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-register',
  imports: [CommonModule, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class Register {
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
    const user = await this.authService.googleLogin();
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
