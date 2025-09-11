// models/profile.model.ts
export interface Profile {
  id: string; // same as Firebase UID
  name: string;
  email: string;
  bio?: string;
  photoURL: string;
  nbFollowers: number;
  nbFollowed: number;
  streaks: number;
  nbViews: number;
  nbUpvotes: number;
  lastWriteDay?: Date;
  xp: number;
  level: number;
  isActive: boolean;
  isFollowing?: boolean; // optional: for UI when viewing others
  role: 'user';
  createdAt: Date;
  updatedAt: Date;
  lastLoggedInAt?: Date;
  socialLinks?: {
    fb?: string;
    ig?: string;
    linkedin?: string;
  };
}
