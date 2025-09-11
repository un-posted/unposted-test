import { Timestamp } from '@angular/fire/firestore';

// Helper type to convert Date to Timestamp for Firestore
export type FirestoreTimestamp<T> = {
  [K in keyof T]: T[K] extends Date ? Timestamp : T[K];
};

// Helper type for pagination
export interface PaginationOptions {
  limit?: number;
  startAfter?: any; // DocumentSnapshot or cursor
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

// Helper type for query results
export interface QueryResult<T> {
  items: T[];
  hasMore: boolean;
  lastDoc?: any; // For pagination cursor
  total?: number;
}

// Validation schemas (if you want to add runtime validation)
export const StoryValidation = {
  title: { required: true, minLength: 3, maxLength: 200 },
  content: { required: true, minLength: 10, maxLength: 10000 },
  category: { required: true, maxLength: 50 },
  emoji: { required: true, maxLength: 10 },
  tags: { maxItems: 10, itemMaxLength: 30 }
};

export const CommentValidation = {
  text: { required: true, minLength: 1, maxLength: 500 },
  authorName: { required: true, maxLength: 100 }
};

// Enums for better type safety
export enum StoryStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export enum CommentStatus {
  ACTIVE = 'active',
  HIDDEN = 'hidden',
  FLAGGED = 'flagged'
}

export enum VoteType {
  UPVOTE = 'upvote',
  DOWNVOTE = 'downvote'
}

export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin'
}