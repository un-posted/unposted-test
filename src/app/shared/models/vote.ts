// shared/models/vote.ts
import { Timestamp } from '@angular/fire/firestore';

export interface Vote {
  id?: string; // Firestore document ID (usually userId)
  storyId: string; // Reference to parent story
  userId: string; // Firebase Auth UID
  type: 'upvote' | 'downvote'; // Vote type (currently only upvote)
  createdAt: Timestamp | Date;
  
  // Optional metadata for analytics
  userAgent?: string;
  source?: 'web' | 'mobile' | 'api'; // Platform tracking
}

// For creating votes (simplified since we only store upvotes)
export type CreateVoteData = Omit<Vote, 'id' | 'createdAt'> & {
  type?: 'upvote'; // Default to upvote
};