// services/follow.service.ts
import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, deleteDoc, getDoc, updateDoc, increment, serverTimestamp, collection, getDocs, query, where } from '@angular/fire/firestore';
import { Follow } from '../models/follow';

@Injectable({ providedIn: 'root' })
export class FollowService {
  private firestore = inject(Firestore);

  async toggleFollow(followerId: string, followedId: string) {
  if (!followerId || !followedId) {
    throw new Error("FollowerId or FollowingId is undefined");
  }

  const followRef = doc(
    this.firestore,
    `follows/${followerId}_${followedId}`
  );

  const snap = await getDoc(followRef);

  if (snap.exists()) {
    await deleteDoc(followRef);
  } else {
    await setDoc(followRef, {
      followerId,
      followedId,
      createdAt: serverTimestamp(),
    });
  }
}


  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    if (followerId === followingId) {
      return false; // Users can't follow themselves
    }
    
    const ref = doc(this.firestore, `follows/${followerId}_${followingId}`);
    const snap = await getDoc(ref);
    
    return snap.exists();
  }


  async getFollowers(userId: string) {
    const q = query(
      collection(this.firestore, 'follows'),
      where('followedId', '==', userId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  }

  async getFollowing(userId: string) {
    const q = query(
      collection(this.firestore, 'follows'),
      where('followerId', '==', userId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  }
}
