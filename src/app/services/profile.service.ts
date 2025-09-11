import { Injectable, inject } from '@angular/core';
import { Firestore, doc, updateDoc, getDoc, increment, collection, setDoc } from '@angular/fire/firestore';
import { Profile } from '../models/user-profile';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private firestore = inject(Firestore);

  async getProfile(userId: string): Promise<Profile | null> {
    const ref = doc(this.firestore, `profiles/${userId}`);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as Profile) : null;
  }

  async updateProfile(userId: string, data: Partial<Profile>): Promise<void> {
    const ref = doc(this.firestore, `profiles/${userId}`);
    await updateDoc(ref, { ...data, updatedAt: new Date() });
  }

  async awardUserXP(userId: string, amount: number, reason: string): Promise<void> {
    const ref = doc(this.firestore, `profiles/${userId}`);
    
    // Update XP and potentially level up
    await updateDoc(ref, {
      xp: increment(amount),
      updatedAt: new Date()
    });

    // Optional: Log the XP award for analytics
    await this.logXPAward(userId, amount, reason);
    
    // Check if user should level up
    await this.checkLevelUp(userId);
  }

  private async checkLevelUp(userId: string): Promise<void> {
    const profile = await this.getProfile(userId);
    if (!profile) return;

    const xpForNextLevel = this.calculateXPForLevel(profile.level + 1);
    
    if (profile.xp >= xpForNextLevel) {
      const ref = doc(this.firestore, `profiles/${userId}`);
      await updateDoc(ref, {
        level: increment(1),
        updatedAt: new Date()
      });
    }
  }

  private calculateXPForLevel(level: number): number {
    // Example: exponential XP curve
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }

  private async logXPAward(userId: string, amount: number, reason: string): Promise<void> {
    // Optional: Create a subcollection for XP history
    const xpLogRef = doc(collection(this.firestore, `profiles/${userId}/xpLogs`));
    await setDoc(xpLogRef, {
      amount,
      reason,
      timestamp: new Date(),
      totalAfter: (await this.getProfile(userId))?.xp || 0
    });
  }

  
}