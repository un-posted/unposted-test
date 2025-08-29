import { Injectable } from '@angular/core';
import { Firestore, doc, setDoc, getDoc, updateDoc, increment, collection, getDocs } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class ViewsService {

  constructor(private firestore: Firestore) {}

  /**
   * Track a unique view for a story.
   * If userId is provided, view is unique per user.
   * If no userId, it creates a record with 'anonymous' + timestamp.
   */
  async trackView(storyId: string, userId?: string): Promise<void> {
    const viewDocId = userId ? `${userId}` : `anon_${Date.now()}`;
    const viewDocRef = doc(this.firestore, `stories/${storyId}/views/${viewDocId}`);

    const docSnap = await getDoc(viewDocRef);
    if (!docSnap.exists()) {
      // Record the view
      await setDoc(viewDocRef, {
        storyId,
        userId: userId || null,
        timestamp: new Date()
      });

      // Increment a counter in the story doc itself
      const storyDocRef = doc(this.firestore, 'stories', storyId);
      await updateDoc(storyDocRef, {
        viewCount: increment(1)
      }).catch(async () => {
        await setDoc(storyDocRef, { viewCount: 1 }, { merge: true });
      });
    }
  }

  /**
   * Get total unique views for a story.
   */
  async getViewCount(storyId: string): Promise<number> {
    const viewsCollection = collection(this.firestore, `stories/${storyId}/views`);
    const querySnapshot = await getDocs(viewsCollection);
    return querySnapshot.size; // number of view docs
  }
}
