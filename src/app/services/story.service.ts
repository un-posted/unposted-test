// services/story.service.ts
import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  addDoc, 
  collection, 
  Timestamp, 
  getDocs, 
  query, 
  where, 
  DocumentData, 
  QueryDocumentSnapshot, 
  limit, 
  orderBy, 
  startAfter, 
  deleteDoc
} from '@angular/fire/firestore';
import { Story } from '../models';

@Injectable({ providedIn: 'root' })
export class StoryService {
  private firestore = inject(Firestore);

  async createStory(storyData: Omit<Story, 'id' | 'createdAt' | 'updatedAt' | 'stats'>): Promise<string> {
    try {
      // Prepare the story data with required fields
      const story = {
        ...storyData,
        createdAt: new Date(),
        updatedAt: new Date(),
        stats: {
          readTime: this.calculateReadTime(storyData.content),
          wordCount: this.calculateWordCount(storyData.content),
          readCount: 0,
          voteCount: 0,
          commentCount: 0
        }
      };

      // Use addDoc to auto-generate ID
      const storiesRef = collection(this.firestore, 'stories');
      const docRef = await addDoc(storiesRef, story);
      
      // Update the document with its own ID
      await updateDoc(docRef, { id: docRef.id });
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating story:', error);
      throw new Error('Failed to create story');
    }
  }

  async updateStory(storyId: string, data: Partial<Story>): Promise<void> {
    try {
      const ref = doc(this.firestore, `stories/${storyId}`);
      await updateDoc(ref, { 
        ...data, 
        updatedAt: new Date(),
        // Update stats if content changed
        ...(data.content && {
          'stats.readTime': this.calculateReadTime(data.content),
          'stats.wordCount': this.calculateWordCount(data.content)
        })
      });
    } catch (error) {
      console.error('Error updating story:', error);
      throw new Error('Failed to update story');
    }
  }

  async getStory(storyId: string): Promise<Story | null> {
    try {
      const ref = doc(this.firestore, `stories/${storyId}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        return {
          id: snap.id,
          ...data,
        } as Story;
      }
      return null;
    } catch (error) {
      console.error('Error getting story:', error);
      return null;
    }
  }

  async getDraftsByAuthor(authorId: string): Promise<Story[]> {
    try {
      const storiesRef = collection(this.firestore, 'stories');
      const q = query(
        storiesRef, 
        where('authorId', '==', authorId), 
        where('status', '==', 'draft'),
        orderBy('updatedAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Story));
    } catch (error) {
      console.error('Error getting drafts:', error);
      return [];
    }
  }

  async getPublishedByAuthor(authorId: string): Promise<Story[]> {
    try {
      const storiesRef = collection(this.firestore, 'stories');
      const q = query(
        storiesRef, 
        where('authorId', '==', authorId), 
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Story));
    } catch (error) {
      console.error('Error getting published stories:', error);
      return [];
    }
  }

  // Pagination properties
  private lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  private hasMore = true;

  resetPagination(): void {
    this.lastDoc = null;
    this.hasMore = true;
  }

  async getStories(pageSize: number, append = false): Promise<Story[]> {
    if (!this.hasMore) return [];
    
    try {
      const storiesRef = collection(this.firestore, 'stories');
      let q;
      
      if (this.lastDoc) {
        q = query(
          storiesRef,
          where('status', '==', 'published'), // Only get published stories
          orderBy('createdAt', 'desc'),
          startAfter(this.lastDoc),
          limit(pageSize)
        );
      } else {
        q = query(
          storiesRef, 
          where('status', '==', 'published'),
          orderBy('createdAt', 'desc'), 
          limit(pageSize)
        );
      }

      const snap = await getDocs(q);
      const stories = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Story));

      // Update pagination state
      this.lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : this.lastDoc;
      if (snap.docs.length < pageSize) {
        this.hasMore = false;
      }

      return append ? stories : [...stories];
    } catch (error) {
      console.error('Error getting stories:', error);
      return [];
    }
  }

  // Helper methods
  private calculateWordCount(content: string): number {
    if (!content) return 0;
    const textContent = content.replace(/<[^>]*>/g, '');
    return textContent.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private calculateReadTime(content: string): number {
    const wordsPerMinute = 200;
    const words = this.calculateWordCount(content);
    return Math.max(1, Math.ceil(words / wordsPerMinute));
  }


  async deleteStory(storyId: string): Promise<void> {
    try {
      const ref = doc(this.firestore, `stories/${storyId}`);
      await deleteDoc(ref);
    } catch (error) {
      console.error('Error deleting story:', error);
      throw new Error('Failed to delete story');
    }
  }

  async deleteDraft(storyId: string): Promise<void> {
    try {
      // Verify it's actually a draft before deleting
      const story = await this.getStory(storyId);
      if (!story) {
        throw new Error('Story not found');
      }
      
      if (story.status !== 'draft') {
        throw new Error('Cannot delete a published story using deleteDraft method');
      }
      
      const ref = doc(this.firestore, `stories/${storyId}`);
      await deleteDoc(ref);
    } catch (error) {
      console.error('Error deleting draft:', error);
      throw new Error('Failed to delete draft');
    }
  }
}