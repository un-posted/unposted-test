import { Timestamp } from '@angular/fire/firestore';

export interface Follow {
  followerId: string;   // the one who follows
  followingId: string;  // the one being followed
  createdAt: Timestamp;       // Firestore timestamp
}

