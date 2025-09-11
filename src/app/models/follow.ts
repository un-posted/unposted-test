// models/follow.model.ts
export interface Follow {
  id: string; // could be followerId_followingId
  followerId: string;
  followingId: string;
  createdAt: Date;
}
