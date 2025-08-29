import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  deleteDoc,
  addDoc,
  writeBatch
} from '@angular/fire/firestore';

import { getCountFromServer, increment } from 'firebase/firestore';

import { UserProfile, CreateUserProfileData, UpdateUserProfileData } from '../models/user-profile';
import { Draft, CreateDraftData, UpdateDraftData } from '../models/draft';
import { Bookmark, CreateBookmarkData, UpdateBookmarkData } from '../models/bookmark';
import { Story } from '../models/story';
import { Observable, combineLatest, map, switchMap, of } from 'rxjs';
import { User } from '@angular/fire/auth';
import { FollowService } from './follow.service';

@Injectable({ providedIn: 'root' })
export class ProfileService {

constructor(private followService:FollowService){}

  private fs = inject(Firestore);

  // Collections
  private profilesCol = collection(this.fs, 'profiles');
  private draftsCol = collection(this.fs, 'drafts');
  private bookmarksCol = collection(this.fs, 'bookmarks');
  private storiesCol = collection(this.fs, 'stories');

  // ==============
  // PROFILES
  // ==============
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(this.fs, `profiles/${uid}`);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as UserProfile) : null;
  }

  async createOrUpdateProfile(
    user: User,
    data: CreateUserProfileData | UpdateUserProfileData
  ): Promise<void> {
    const docRef = doc(this.fs, 'profiles', user.uid);
    const existingDoc = await getDoc(docRef);

    if (existingDoc.exists()) {
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(docRef, {
        uid: user.uid,
        email: user.email ?? '',
        // sensible defaults in case old profile docs didn’t have these
        preferences: {
          language: 'en',
          theme: 'light',
          emailNotifications: true,
          publicProfile: true,
          ...(data as any)?.preferences
        },
        stats: {
          storiesPublished: 0,
          draftsCount: 0,
          bookmarksCount: 0,
          totalViews: 0,
          totalVotes: 0,
          followersCount: 0,
          followingCount: 0,
          ...(data as any)?.stats
        },
        isActive: true,
        role: 'user',
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  }

  // ==============
  // DRAFTS
  // ==============
  async getUserDrafts(uid: string, limitCount = 20): Promise<Draft[]> {
    const qy = query(
      this.draftsCol,
      where('authorId', '==', uid),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(qy);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Draft));
  }

  private calculateWordCount(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  async createDraft(data: CreateDraftData): Promise<string> {
    const wordCount = this.calculateWordCount(data.content);
    const readTime = Math.ceil(wordCount / 200);

    const docRef = await addDoc(this.draftsCol, {
      ...data,
      wordCount,
      readTime,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // (Optional) touch stats if you own profile rules permit (they don’t by default for others)
    // Best to derive counts in UI instead of mutating stats counters here.

    return docRef.id;
  }

  async updateDraft(draftId: string, data: UpdateDraftData): Promise<void> {
    const updates: any = { ...data, updatedAt: serverTimestamp() };

    if (data.content) {
      updates.wordCount = this.calculateWordCount(data.content);
      updates.readTime = Math.ceil(updates.wordCount / 200);
    }

    const docRef = doc(this.fs, 'drafts', draftId);
    await updateDoc(docRef, updates);
  }

  async deleteDraft(draftId: string, _authorId: string): Promise<void> {
    const docRef = doc(this.fs, 'drafts', draftId);
    await deleteDoc(docRef);
  }

  // Convert draft to published story
  async publishDraft(draftId: string): Promise<string> {
    const draftDoc = await getDoc(doc(this.fs, 'drafts', draftId));
    if (!draftDoc.exists()) throw new Error('Draft not found');

    const draftData = draftDoc.data() as Draft;

    const storyRef = doc(this.storiesCol);
    await setDoc(storyRef, {
      title: draftData.title,
      content: draftData.content,
      excerpt: draftData.excerpt ?? '',
      authorId: draftData.authorId,
      authorName: draftData.authorName,
      category: draftData.category || 'General',
      emoji: draftData.emoji || '📝',
      tags: draftData.tags || [],
      readTime: draftData.readTime ?? Math.ceil((draftData.wordCount || 0) / 200),
      featuredImage: draftData.featuredImage || null,
      language: draftData.language || 'en',
      isPublic: draftData.isPublic ?? true,
      status: 'published',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await this.deleteDraft(draftId, draftData.authorId);
    return storyRef.id;
  }

  // ==============
  // STORIES
  // ==============
  async getUserPublishedStories(uid: string, limitCount = 20): Promise<Story[]> {
    const qy = query(
      this.storiesCol,
      where('authorId', '==', uid),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(qy);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Story));
  }

  // ==============
  // BOOKMARKS
  // ==============
  async getUserBookmarks(uid: string, limitCount = 20): Promise<Bookmark[]> {
    const qy = query(
      this.bookmarksCol,
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(qy);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Bookmark));
  }

  async createBookmark(data: CreateBookmarkData): Promise<string> {
    const docRef = await addDoc(this.bookmarksCol, {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    const docRef = doc(this.fs, 'bookmarks', bookmarkId);
    await deleteDoc(docRef);
  }

  async updateBookmark(bookmarkId: string, data: UpdateBookmarkData): Promise<void> {
    const docRef = doc(this.fs, 'bookmarks', bookmarkId);
    await updateDoc(docRef, data);
  }

  async isStoryBookmarked(userId: string, storyId: string): Promise<boolean> {
    const qy = query(
      this.bookmarksCol,
      where('userId', '==', userId),
      where('storyId', '==', storyId),
      limit(1)
    );
    const snapshot = await getDocs(qy);
    return !snapshot.empty;
  }

  // ==============
  // FOLLOW / UNFOLLOW
  // ==============
  private followerDocRef(targetUid: string, followerUid: string) {
    return doc(this.fs, 'profiles', targetUid, 'followers', followerUid);
  }
  private followingDocRef(ownerUid: string, followedUid: string) {
    return doc(this.fs, 'profiles', ownerUid, 'following', followedUid);
  }

  async isFollowing(currentUid: string, targetUid: string): Promise<boolean> {
    if (!currentUid || !targetUid || currentUid === targetUid) return false;
    const ref = this.followingDocRef(currentUid, targetUid);
    const snap = await getDoc(ref);
    return snap.exists();
  }

  async followUser(currentUid: string, targetUid: string): Promise<void> {
    if (!currentUid) throw new Error('Not authenticated');
    if (!targetUid) throw new Error('Invalid target user');
    if (currentUid === targetUid) return; // no self-follow

    const followerRef = this.followerDocRef(targetUid, currentUid);
    const followingRef = this.followingDocRef(currentUid, targetUid);

    const followerSnap = await getDoc(followerRef);
    if (followerSnap.exists()) return; // already following

    const batch = writeBatch(this.fs);
    batch.set(followerRef, { uid: currentUid, createdAt: serverTimestamp() });
    batch.set(followingRef, { uid: targetUid, createdAt: serverTimestamp() });
    await batch.commit();
  }

  async unfollowUser(currentUid: string, targetUid: string): Promise<void> {
    if (!currentUid) throw new Error('Not authenticated');
    if (!targetUid) throw new Error('Invalid target user');
    if (currentUid === targetUid) return;

    const followerRef = this.followerDocRef(targetUid, currentUid);
    const followingRef = this.followingDocRef(currentUid, targetUid);

    const batch = writeBatch(this.fs);
    batch.delete(followerRef);
    batch.delete(followingRef);
    await batch.commit();
  }

  async getFollowersCount(uid: string): Promise<number> {
    const col = collection(this.fs, 'profiles', uid, 'followers');
    const agg = await getCountFromServer(query(col));
    return agg.data().count;
  }

  async getFollowingCount(uid: string): Promise<number> {
    const col = collection(this.fs, 'profiles', uid, 'following');
    const agg = await getCountFromServer(query(col));
    return agg.data().count;
  }

  // ==============
  // COMPOSITES
  // ==============
  getCompleteProfileData(): Observable<{
    profile: UserProfile | null;
    drafts: Draft[];
    stories: Story[];
    bookmarks: Bookmark[];
  }> {
    // Kept for compatibility if you use it elsewhere
    return combineLatest([
      of(null), // you can plug your authService.uid$ stream here if you want
      of([]),
      of([]),
      of([])
    ]).pipe(
      map(([profile, drafts, stories, bookmarks]) => ({
        profile,
        drafts,
        stories,
        bookmarks
      }))
    );
  }

async getUserStoryCount(userId: string): Promise<number> {
    try {
      const storiesRef = collection(this.fs, 'stories');
      const q = query(storiesRef, where('authorId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.size; // returns number of stories
    } catch (error) {
      console.error('Error getting user story count:', error);
      return 0;
    }
  }

  async getProfileWithStats(uid: string, currentUserId?: string): Promise<UserProfile | null> {
    const profile = await this.getUserProfile(uid);
    if (!profile) return null;

    profile.storyCount = await this.getUserStoryCount(uid);
    profile.followerCount = await this.followService.countFollowers(uid);
    profile.followingCount = await this.followService.countFollowing(uid);

    if (currentUserId) {
      profile.isFollowing = await this.followService.isFollowing(currentUserId, uid);
    }

    return profile;
  }


  /**
   * Award XP points to a user and optionally log a reason.
   * @param uid User ID
   * @param amount Number of XP points to add
   * @param reason Optional reason for logging the XP gain
   */
  async awardUserXP(uid: string, amount: number, reason?: string): Promise<void> {
    try {
      const userRef = doc(this.fs, 'profiles', uid);

      // Increment XP and update lastXPDate
      await updateDoc(userRef, {
        'stats.xp': increment(amount),
        lastXPAwardedAt: serverTimestamp()
      });

      // Optional: log the XP award in a subcollection
      if (reason) {
        const xpLogRef = doc(this.fs, `profiles/${uid}/xpLogs/${Date.now().toString()}`);
        await updateDoc(xpLogRef, {
          amount,
          reason,
          awardedAt: serverTimestamp()
        }).catch(async () => {
          // If doc doesn't exist, create it
          await setDoc(xpLogRef, {
            amount,
            reason,
            awardedAt: serverTimestamp()
          });
        });
      }
    } catch (error) {
      console.error(`Error awarding XP to user ${uid}:`, error);
    }
  }
}
