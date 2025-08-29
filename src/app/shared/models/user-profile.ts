import { Timestamp } from '@angular/fire/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  bio?: string;
  location?: string;
  website?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    github?: string;
    personal?: string;
  };
  preferences: {
    language: 'en' | 'ar' | 'fr';
    theme: 'light' | 'dark' | 'auto';
    emailNotifications: boolean;
    publicProfile: boolean;
  };
  stats: {
    storiesPublished: number;
    draftsCount: number;
    bookmarksCount: number;
    totalViews: number;
    totalVotes: number;
    followersCount: number;
    followingCount: number;
    xp?: number;
  };
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  lastLoginAt?: Timestamp | Date;
  isActive: boolean;
  role: 'user' | 'moderator' | 'admin';

  // Computed fields
  storyCount?: number;
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  writingStreak: number;
  totalXP: number;
  level: number;
}


// For creating new user profiles
export type CreateUserProfileData = Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt' | 'lastLoginAt'>;

// For updating user profiles
export type UpdateUserProfileData = Partial<Omit<UserProfile, 'uid' | 'email' | 'createdAt' | 'role'>>;
