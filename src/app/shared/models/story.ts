// shared/models/story.ts
import { Timestamp } from '@angular/fire/firestore';

export interface Story {
  id: string; // Firestore document ID
  title: string;
  content: string;
  authorId: string; // Firebase Auth UID
  authorName: string; // Display name or email username
  category: string;
  emoji: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  tags?: string[]; // Optional tags for filtering
  readTime?: number; // Estimated read time in minutes
  isPublic: boolean; // Privacy setting
  wordCount: number;
  featuredImage?: string; // Optional cover image URL
  excerpt?: string; // Short description/summary
  language?: 'en' | 'ar' | 'fr' | string; // Language code
  
  // Computed fields (not stored in Firestore)
  readCount: number;
  voteCount?: number;
  commentCount?: number;
  hasUserVoted?: boolean;
}

// For creating new stories (excludes auto-generated fields)
export type CreateStoryData = Omit<Story, 'id' | 'createdAt' | 'updatedAt' | 'voteCount' | 'commentCount' | 'hasUserVoted'>;

// For updating stories (makes most fields optional)
export type UpdateStoryData = Partial<Omit<Story, 'id' | 'authorId' | 'createdAt'>>;