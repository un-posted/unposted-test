import { Injectable, inject } from '@angular/core';
import { Auth, authState, createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, User } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { Profile } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  user$ = authState(this.auth);  // 🔥 real-time observable of user
  user : any;

  constructor() {
  onAuthStateChanged(this.auth, (user) => {
    this.user = user; // keeps it updated even on refresh
  });
}


async emailRegister(email: string, password: string) { 
  const cred = await createUserWithEmailAndPassword(this.auth, email, password);
  this.user = cred.user;

  if (cred.user) {
    await this.ensureProfile(cred.user);
  }

  return cred.user;
}
  async emailLogin(email: string, password: string) { return signInWithEmailAndPassword(this.auth, email, password); }

  async googleLogin(): Promise<User | null> {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(this.auth, provider);
    this.user = credential.user;
    const user = credential.user;

    if (user) {
      await this.ensureProfile(user);
    }

    return user;
  }

  async logout(): Promise<void> {
    return signOut(this.auth);
  }

  private async ensureProfile(user: User): Promise<void> {
    const ref = doc(this.firestore, `profiles/${user.uid}`);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const newProfile: Profile = {
        id: user.uid,
        name: user.displayName ?? 'Unposter',
        email: user.email ?? '',
        bio: '',
        photoURL: user.photoURL ?? '',
        nbFollowers: 0,
        nbFollowed: 0,
        streaks: 0,
        nbViews: 0,
        nbUpvotes: 0,
        xp: 0,
        level: 1,
        isActive: true,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoggedInAt: new Date(),
        socialLinks: {},
      };
      await setDoc(ref, newProfile);
    } else {
      await updateDoc(ref, {
        lastLoggedInAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}
