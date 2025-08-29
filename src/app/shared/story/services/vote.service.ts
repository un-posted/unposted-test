import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, deleteDoc, collection } from '@angular/fire/firestore';
import { serverTimestamp } from 'firebase/firestore';
// For efficient counts:
import { getCountFromServer, query } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class VotesService {
  private fs = inject(Firestore);

  voteDoc(storyId: string, userId: string) {
    return doc(this.fs, 'stories', storyId, 'votes', userId);
  }

  async hasVoted(storyId: string, userId: string) {
    const snap = await getDoc(this.voteDoc(storyId, userId));
    return snap.exists();
  }

  async toggleVote(storyId: string, userId: string) {
    const ref = this.voteDoc(storyId, userId);
    const exists = (await getDoc(ref)).exists();
    return exists
      ? deleteDoc(ref)
      : setDoc(ref, { createdAt: serverTimestamp() });
  }

  async countVotes(storyId: string) {
    // Efficient server-side count aggregation
    const col = collection(this.fs, 'stories', storyId, 'votes');
    const q = query(col);
    const agg = await getCountFromServer(q);
    return agg.data().count;
  }
}
