import { Timestamp } from '@angular/fire/firestore';

export interface Bookmark {
  id: string;
  userId: string;
  storyId: string;
  storyTitle: string;
  storyAuthor: string;
  storyExcerpt?: string;
  storyUrl?: string; // For external bookmarks
  tags?: string[];
  notes?: string; // Personal notes about the bookmark
  createdAt: Timestamp | Date;
  isPublic: boolean; // Whether this bookmark is visible to others
  category?: string; // User-defined category
}



export type CreateBookmarkData = Omit<Bookmark, 'id' | 'createdAt'>;
export type UpdateBookmarkData = Partial<Omit<Bookmark, 'id' | 'userId' | 'storyId' | 'createdAt'>>;