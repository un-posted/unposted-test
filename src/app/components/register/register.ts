import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-register',
  imports: [],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class Register {
private authService = inject(AuthService);
  private router = inject(Router);
  private profileService = inject(ProfileService); // ✅ inject



  errorMessage = '';
  successMessage = '';
  isLoading = false;



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
