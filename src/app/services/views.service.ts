// services/views.service.ts
import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  increment, 
  collection, 
  getDocs,
  serverTimestamp 
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class ViewsService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  /**
   * Track a unique view for a story.
   * Uses authenticated user's UID or generates anonymous ID.
   */
  async trackView(storyId: string): Promise<void> {
    try {
      const currentUser = this.auth.currentUser;
      let viewDocId: string;
      
      if (currentUser) {
        // Authenticated user - use their UID
        viewDocId = currentUser.uid;
      } else {
        // Anonymous user - generate ID that matches security rules pattern
        viewDocId = `anon_${Date.now()}`;
      }

      const viewDocRef = doc(this.firestore, `stories/${storyId}/views/${viewDocId}`);
      
      // Check if view already exists to avoid duplicate counting
      const docSnap = await getDoc(viewDocRef);
      
      if (!docSnap.exists()) {
        // Record the view
        await setDoc(viewDocRef, {
          storyId,
          userId: currentUser?.uid || null,
          isAnonymous: !currentUser,
          timestamp: serverTimestamp()
        });

        // Increment story.stats.readCount
        await this.incrementStoryReadCount(storyId);
      }
    } catch (error) {
      console.error('Error tracking view:', error);
      // Don't throw - view tracking shouldn't break the app
    }
  }

  /**
   * Private method to increment story read count with error handling
   */
  private async incrementStoryReadCount(storyId: string): Promise<void> {
    try {
      const storyDocRef = doc(this.firestore, 'stories', storyId);
      await updateDoc(storyDocRef, {
        'stats.readCount': increment(1)
      });
    } catch (updateError) {
      // If update fails (document might not have stats field), create it
      try {
        const storyDocRef = doc(this.firestore, 'stories', storyId);
        await setDoc(storyDocRef, { 
          stats: { readCount: 1 } 
        }, { merge: true });
      } catch (setError) {
        console.error('Error setting story read count:', setError);
      }
    }
  }

  /**
   * Get total unique views for a story.
   */
  async getViewCount(storyId: string): Promise<number> {
    try {
      const viewsCollection = collection(this.firestore, `stories/${storyId}/views`);
      const querySnapshot = await getDocs(viewsCollection);
      return querySnapshot.size;
    } catch (error) {
      console.error('Error getting view count:', error);
      return 0;
    }
  }

  /**
   * Check if current user has viewed a story
   */
  async hasUserViewed(storyId: string): Promise<boolean> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) return false;

      const viewDocRef = doc(this.firestore, `stories/${storyId}/views/${currentUser.uid}`);
      const docSnap = await getDoc(viewDocRef);
      return docSnap.exists();
    } catch (error) {
      console.error('Error checking if user viewed story:', error);
      return false;
    }
  }
}