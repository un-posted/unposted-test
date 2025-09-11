// services/comment.service.ts
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp, query, getDocs, orderBy, where, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import { Comment } from '../models';

@Injectable({ providedIn: 'root' })
export class CommentService {
  private firestore = inject(Firestore);

  async addComment(
    storyId: string,
    data: {
      userId: string;
      username: string;
      userPhotoURL?: string;
      content: string;
    }
  ): Promise<void> {
    const ref = collection(this.firestore, 'comments');
    await addDoc(ref, {
      storyId,
      ...data,
      createdAt: new Date(),
      status: 'active'
    });
  }


  async getComments(storyId: string): Promise<Comment[]> {
    const ref = collection(this.firestore, 'comments');
    const q = query(
      ref,
      where('storyId', '==', storyId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Comment[];
  }

  async deleteOwnComment(storyId: string, commentId: string, userId: string): Promise<void> {
    const ref = doc(this.firestore, `comments/${commentId}`);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      if (data?.['storyId'] === storyId && data?.['userId'] === userId) {
        // Soft delete
        await updateDoc(ref, { status: 'deleted' });
      } else {
        throw new Error('Not authorized to delete this comment');
      }
    }
  }

  async countComments(storyId: string): Promise<number> {
    const ref = collection(this.firestore, 'comments');
    const q = query(ref, where('storyId', '==', storyId), where('status', '==', 'active'));

    const snapshot = await getDocs(q);
    return snapshot.size; // 👈 count of docs
  }
}
