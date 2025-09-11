// services/bookmark.service.ts
import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, deleteDoc, getDoc, getDocs, collection, query, where } from '@angular/fire/firestore';
import { Bookmark } from '../models';

@Injectable({ providedIn: 'root' })
export class BookmarkService {
  private firestore = inject(Firestore);

  async toggleBookmark(bookmark: Bookmark): Promise<void> {
    const ref = doc(this.firestore, `bookmarks/${bookmark.userId}_${bookmark.storyId}`);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      await deleteDoc(ref); // unbookmark
    } else {
      await setDoc(ref, bookmark);
    }
  }

  async getUserBookmarks(userId: string): Promise<Bookmark[]> {
    const bookmarksRef = collection(this.firestore, 'bookmarks');
    const q = query(bookmarksRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => doc.data() as Bookmark);
  }
}
