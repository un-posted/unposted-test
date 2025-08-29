import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, getCountFromServer } from '@angular/fire/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { Comment } from '../../models/comment';

@Injectable({ providedIn: 'root' })
export class CommentsService {
  private fs = inject(Firestore);

  async getComments(storyId: string, limitCount = 50) {
    const col = collection(this.fs, 'stories', storyId, 'comments');
    const q = query(col, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
  }

  async addComment(storyId: string, data: any) {
    const col = collection(this.fs, 'stories', storyId, 'comments');
    return addDoc(col, data); // data already includes createdAt
  }
  

  async deleteOwnComment(storyId: string, commentId: string) {
    const ref = doc(this.fs, 'stories', storyId, 'comments', commentId);
    return deleteDoc(ref);
  }

  async countComments(storyId: string) {
    // Efficient server-side count aggregation
    const col = collection(this.fs, 'stories', storyId, 'comments');
    const q = query(col);
    const agg = await getCountFromServer(q);
    return agg.data().count;
  }
}
