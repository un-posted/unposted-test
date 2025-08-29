import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, deleteDoc, doc, query, where, getDocs, serverTimestamp } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class FollowService {
  private firestore = inject(Firestore);
  private followsCol = collection(this.firestore, 'follows');

  async followUser(followerId: string, followingId: string) {
    const q = query(this.followsCol,
      where('followerId', '==', followerId),
      where('followingId', '==', followingId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return; // already following

    await addDoc(this.followsCol, {
      followerId,
      followingId,
      createdAt: serverTimestamp(),
    });
  }

  async unfollowUser(followerId: string, followingId: string) {
    const q = query(this.followsCol,
      where('followerId', '==', followerId),
      where('followingId', '==', followingId)
    );
    const snap = await getDocs(q);
    snap.forEach(async (docSnap) => {
      await deleteDoc(doc(this.firestore, 'follows', docSnap.id));
    });
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const q = query(this.followsCol,
      where('followerId', '==', followerId),
      where('followingId', '==', followingId)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  }

  async countFollowers(uid: string): Promise<number> {
    const q = query(this.followsCol, where('followingId', '==', uid));
    const snap = await getDocs(q);
    return snap.size;
  }

  async countFollowing(uid: string): Promise<number> {
    const q = query(this.followsCol, where('followerId', '==', uid));
    const snap = await getDocs(q);
    return snap.size;
  }
}
