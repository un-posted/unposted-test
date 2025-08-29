import { Timestamp } from '@angular/fire/firestore';

export interface Draft {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  authorId: string;
  authorName: string;
  category?: string;
  emoji?: string;
  tags?: string[];
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  wordCount: number;
  readTime?: number; // Estimated read time in minutes
  featuredImage?: string;
  language?: 'en' | 'ar' | 'fr' | string;
  isPublic: boolean;
  scheduledFor?: Timestamp | Date; // For scheduled publishing
}

export type CreateDraftData = Omit<Draft, 'id' | 'createdAt' | 'updatedAt' | 'wordCount'>;
export type UpdateDraftData = Partial<Omit<Draft, 'id' | 'authorId' | 'createdAt'>>;
