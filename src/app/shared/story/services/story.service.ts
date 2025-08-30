import { Injectable, inject } from '@angular/core';
import { 
  Firestore, collection, addDoc, getDocs, getDoc, doc, query, 
  orderBy, limit, startAfter, DocumentData, QueryDocumentSnapshot 
} from '@angular/fire/firestore';
import { Story } from '../../models/story';
import { serverTimestamp } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class StoriesService {
  private fs = inject(Firestore);
  private col = collection(this.fs, 'stories');
  private lastVisible: QueryDocumentSnapshot<DocumentData> | null = null;

  async createStory(data: Omit<Story, 'id' | 'createdAt'>) {
    return addDoc(this.col, { ...data, createdAt: serverTimestamp() });
  }

  async getStories(limitCount = 20, loadMore = false) {
    let q;
    
    if (loadMore && this.lastVisible) {
      // Load next page starting after the last document from previous query
      q = query(
        this.col, 
        orderBy('createdAt', 'desc'), 
        startAfter(this.lastVisible),
        limit(limitCount)
      );
    } else {
      // Load first page
      q = query(
        this.col, 
        orderBy('createdAt', 'desc'), 
        limit(limitCount)
      );
      this.lastVisible = null; // Reset for new queries
    }
    
    const snap = await getDocs(q);
    
    // Store the last document for pagination
    if (!snap.empty) {
      this.lastVisible = snap.docs[snap.docs.length - 1];
    }
    
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Story));
  }

  async getStoryById(id: string) {
    const ref = doc(this.fs, 'stories', id);
    const snap = await getDoc(ref);
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Story) : null;
  }

  // Reset pagination when filters change
  resetPagination() {
    this.lastVisible = null;
  }
}