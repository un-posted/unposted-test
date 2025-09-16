import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
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
