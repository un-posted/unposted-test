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
  serverTimestamp,
  writeBatch
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class ViewsService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private viewCache = new Map<string, boolean>(); // Cache to prevent duplicate tracking

  /**
   * Generate or retrieve persistent anonymous ID with fallback.
   */
  private getAnonId(): string {
    const key = 'anonId';
    try {
      let anonId = localStorage.getItem(key);
      if (!anonId) {
        // Use crypto.randomUUID() with fallback for older browsers
        anonId = `anon_${this.generateUUID()}`;
        localStorage.setItem(key, anonId);
      }
      return anonId;
    } catch (error) {
      // Fallback if localStorage is not available
      console.warn('localStorage not available, using session-based ID');
      return `anon_${this.generateUUID()}`;
    }
  }

  /**
   * Generate UUID with fallback for older browsers
   */
  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback UUID generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Track a unique view for a story using batch writes for consistency.
   */
  async trackView(storyId: string): Promise<void> {
    try {
      const currentUser = this.auth.currentUser;
      let viewDocId: string;
      
      if (currentUser) {
        viewDocId = currentUser.uid;
      } else {
        viewDocId = this.getAnonId();
      }

      // Check cache first to prevent duplicate calls
      const cacheKey = `${storyId}-${viewDocId}`;
      if (this.viewCache.has(cacheKey)) {
        return;
      }

      const viewDocRef = doc(this.firestore, `stories/${storyId}/views/${viewDocId}`);
      const docSnap = await getDoc(viewDocRef);
      
      if (!docSnap.exists()) {
        // Use batch write for consistency
        const batch = writeBatch(this.firestore);
        
        // Add view document
        batch.set(viewDocRef, {
          storyId,
          userId: currentUser?.uid || viewDocId,
          isAnonymous: !currentUser,
          timestamp: serverTimestamp(),
          userAgent: navigator.userAgent.substring(0, 200) // Limit length
        });

        // Increment story read count
        const storyDocRef = doc(this.firestore, 'stories', storyId);
        batch.update(storyDocRef, {
          'stats.readCount': increment(1)
        });

        await batch.commit();
        
        // Cache the successful tracking
        this.viewCache.set(cacheKey, true);
        
        console.log(`View tracked for story ${storyId}`);
      } else {
        // Cache even if view already exists
        this.viewCache.set(cacheKey, true);
      }
    } catch (error) {
      console.error('Error tracking view:', error);
      
      // Fallback: try to increment read count only
      try {
        await this.incrementStoryReadCount(storyId);
      } catch (fallbackError) {
        console.error('Fallback read count increment failed:', fallbackError);
      }
    }
  }

  /**
   * Private method to increment story read count with better error handling
   */
  private async incrementStoryReadCount(storyId: string): Promise<void> {
    try {
      const storyDocRef = doc(this.firestore, 'stories', storyId);
      
      // First try to update existing stats
      await updateDoc(storyDocRef, {
        'stats.readCount': increment(1)
      });
      
    } catch (updateError: any) {
      // If stats object doesn't exist, create it
      if (updateError?.code === 'not-found' || updateError?.message?.includes('No document')) {
        try {
          const storyDocRef = doc(this.firestore, 'stories', storyId);
          await setDoc(storyDocRef, {
            stats: { 
              readCount: 1,
              voteCount: 0
            }
          }, { merge: true });
        } catch (setError) {
          console.error('Error creating story stats:', setError);
          throw setError;
        }
      } else {
        console.error('Error updating story read count:', updateError);
        throw updateError;
      }
    }
  }

  /**
   * Get total unique views for a story with caching.
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
      let viewDocId: string;
      
      if (currentUser) {
        viewDocId = currentUser.uid;
      } else {
        viewDocId = this.getAnonId();
      }

      // Check cache first
      const cacheKey = `${storyId}-${viewDocId}`;
      if (this.viewCache.has(cacheKey)) {
        return this.viewCache.get(cacheKey)!;
      }

      const viewDocRef = doc(this.firestore, `stories/${storyId}/views/${viewDocId}`);
      const docSnap = await getDoc(viewDocRef);
      const hasViewed = docSnap.exists();
      
      // Cache the result
      this.viewCache.set(cacheKey, hasViewed);
      
      return hasViewed;
    } catch (error) {
      console.error('Error checking if user viewed story:', error);
      return false;
    }
  }

  /**
   * Clear the view cache (useful for testing or when user logs out)
   */
  clearCache(): void {
    this.viewCache.clear();
  }

  /**
   * Get view analytics for a story (optional advanced feature)
   */
  async getViewAnalytics(storyId: string): Promise<{
    totalViews: number;
    authenticatedViews: number;
    anonymousViews: number;
  }> {
    try {
      const viewsCollection = collection(this.firestore, `stories/${storyId}/views`);
      const querySnapshot = await getDocs(viewsCollection);
      
      let authenticatedViews = 0;
      let anonymousViews = 0;
      
      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data['isAnonymous']) {
          anonymousViews++;
        } else {
          authenticatedViews++;
        }
      });
      
      return {
        totalViews: querySnapshot.size,
        authenticatedViews,
        anonymousViews
      };
    } catch (error) {
      console.error('Error getting view analytics:', error);
      return {
        totalViews: 0,
        authenticatedViews: 0,
        anonymousViews: 0
      };
    }
  }
}