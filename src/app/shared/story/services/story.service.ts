import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, getDoc, doc, query, orderBy, limit } from '@angular/fire/firestore';
import { Story } from '../../models/story';
import { serverTimestamp } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class StoriesService {
  private fs = inject(Firestore);
  private col = collection(this.fs, 'stories');

  async createStory(data: Omit<Story, 'id' | 'createdAt'>) {
    return addDoc(this.col, { ...data, createdAt: serverTimestamp() });
  }
  

  async getStories(limitCount = 20) {
    const q = query(this.col, orderBy('createdAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Story));
    // For pagination later, store snap.docs[snap.docs.length-1] as cursor
  }

  async getStoryById(id: string) {
    const ref = doc(this.fs, 'stories', id);
    const snap = await getDoc(ref);
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Story) : null;
  }
}
