import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, getDoc, doc, query, orderBy, limit } from '@angular/fire/firestore';
import { deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { Draft } from '../../models/draft';

@Injectable({ providedIn: 'root' })
export class DraftsService {
  private fs = inject(Firestore);
  private col = collection(this.fs, 'drafts');

  // Create a draft
  async createDraft(data: Omit<Draft, 'id' | 'createdAt' | 'updatedAt' | 'wordCount'>) {
    return addDoc(this.col, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      wordCount: this.getWordCount(data.content),
    });
  }

  // Fetch recent drafts
  async getDrafts(limitCount = 20) {
    const q = query(this.col, orderBy('createdAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Draft));
  }

  // Fetch single draft by ID
  async getDraftById(id: string) {
    const ref = doc(this.fs, 'drafts', id);
    const snap = await getDoc(ref);
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Draft) : null;
  }

  async getDraftsByAuthor(authorId: string, limitCount = 20) {
  const q = query(
    this.col,
    where('authorId', '==', authorId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Draft));
}
async deleteDraft(id: string) {
  const ref = doc(this.fs, 'drafts', id);
  await deleteDoc(ref);
}
  // Helper: count words in content
  private getWordCount(content: string): number {
    return content ? content.trim().split(/\s+/).length : 0;
  }
}
