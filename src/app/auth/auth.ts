import { Injectable, inject } from '@angular/core';
import {
  Auth, authState, GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User
} from '@angular/fire/auth';
import { map, Observable, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  user$: Observable<User | null> = authState(this.auth).pipe(
    tap(user => {
      if (user) {
        // Store UID in sessionStorage when user logs in
        sessionStorage.setItem('currentUserId', user.uid);
      } else {
        sessionStorage.removeItem('currentUserId');
      }
    })
  );
  uid$ = this.user$.pipe(map(u => u?.uid ?? null));

  

  async emailRegister(email: string, password: string) { return createUserWithEmailAndPassword(this.auth, email, password); }
  async emailLogin(email: string, password: string) { return signInWithEmailAndPassword(this.auth, email, password); }
  async logout() { return signOut(this.auth); }


  async googleLogin() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      return result.user;
    } catch (error) {
      throw error;
    }
  }
}
