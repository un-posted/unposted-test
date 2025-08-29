// shared/models/comment.ts
import { Timestamp } from '@angular/fire/firestore';

export interface Comment {
  id?: string; // Firestore document ID
  storyId: string; // Reference to parent story
  content: string;
  authorId: string; // Firebase Auth UID
  userId: string;
  username: string; // Display name or email username
  authorEmail?: string; // For moderation purposes
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  isEdited?: boolean; // Track if comment was edited
  parentId?: string; // For nested/reply comments (optional)
  status: 'active' | 'hidden' | 'flagged'; // Moderation status
  likes?: number; // Optional like count for comments
  
  // Optional metadata
  userAgent?: string; // For spam detection
  ipAddress?: string; // For moderation (if needed)
}

// For creating new comments
export type CreateCommentData = Omit<Comment, 'id' | 'createdAt' | 'updatedAt' | 'isEdited' | 'likes'> & {
  status?: 'active' | 'hidden' | 'flagged'; // Make status optional with default 'active'
};

// For updating comments
export type UpdateCommentData = {
  text: string;
  updatedAt: Timestamp | Date;
  isEdited: true;
};
