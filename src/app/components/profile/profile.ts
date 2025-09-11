import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { getAuth, UserProfile } from '@angular/fire/auth';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, forkJoin, of, EMPTY } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { Story, Bookmark } from '../../models';
import { ProfileService } from '../../services/profile.service';
import { ViewsService } from '../../services/views.service';
import { VoteService } from '../../services/vote.service';
import { AuthService } from '../../services/auth.service';
import { StoryService } from '../../services/story.service';
import { BookmarkService } from '../../services/bookmark.service';
import { FollowService } from '../../services/follow.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { Timestamp } from '@angular/fire/firestore';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  requirement?: number;
}

interface ProfileStats {
  totalViews: number;
  totalVotes: number;
  followerCount: number;
  followingCount: number;
}

@Component({
  selector: 'app-profile',
  imports: [FormsModule, CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class Profile implements OnInit, OnDestroy {
    
  @ViewChild('nameInput') nameInput!: ElementRef;
  @ViewChild('bioInput') bioInput!: ElementRef;

  currentUser = getAuth().currentUser;

  // Component state
  userProfile: any = null;
  stories: Story[] = [];
  drafts: Story[] = [];
  bookmarks: Bookmark[] = [];
  
  activeTab: 'drafts' | 'articles' | 'bookmarks' = 'drafts';
  loading = true;
  savingProfile = false;
  loadingStats = false;
  loadingBadges = false;
  deletingItem: string | null = null;
  
  // Edit state
  editingName = false;
  editingBio = false;
  tempName = '';
  tempBio = '';

  // Auto-save timers
  private bioSaveTimeout: any = null;
  private nameSaveTimeout: any = null;

  // Gamification state
  badges: Badge[] = [];
  isOwnProfile = false;
  isFollowing = false;
  followLoading = false;

  // XP and Achievement state
  xpProgress = 0;
  nextLevelXP = 0;
  currentLevelXP = 0;
  streakUpdated = false;
  badgesInitialized = false;

  // Default avatar
  defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iNjAiIGZpbGw9IiNlNmIxN2EiLz4KPHN2ZyB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEuNSI+CjxwYXRoIGQ9Im0zIDkgOS0xIDktMW0tMSAyIDEwIDEwaDEwbC04LTEwbS0xLTEwSDhsLTggMTB2MTBsOC0xMVoiLz4KPC9zdmc+Cjwvc3ZnPgo=';
  
  private destroy$ = new Subject<void>();

  // Cache for expensive operations
  private statsCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private profileService: ProfileService,
    private route: ActivatedRoute,
    private viewsService: ViewsService,
    private voteService: VoteService,
    private storyService: StoryService,
    private bookmarkService: BookmarkService,
    private authService: AuthService,
    private followService: FollowService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    // Set initial tab from session storage
    this.activeTab = this.getInitialTab();

    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap(async paramMap => {
          const uid: any = paramMap.get('id');
          const currentUserId = this.authService.user?.uid || this.currentUser?.uid;
          
          this.isOwnProfile = (!uid || uid === currentUserId);

          if (!currentUserId) {
            console.error('Anonymous user must provide profile ID in route');
            this.router.navigate(['/login']);
            return EMPTY;
          }

          // If not own profile and not showing articles, switch to articles
          if (!this.isOwnProfile && this.activeTab !== 'articles') {
            this.activeTab = 'articles';
          }

          // Start loading immediately with optimized approach
          await this.loadProfileDataOptimized(uid);
          return of(null);
        })
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clear any pending timeouts
    if (this.bioSaveTimeout) clearTimeout(this.bioSaveTimeout);
    if (this.nameSaveTimeout) clearTimeout(this.nameSaveTimeout);
  }

  private getInitialTab(): 'drafts' | 'articles' | 'bookmarks' {
    const saved = sessionStorage.getItem('profileActiveTab') as any;
    
    if (!this.isOwnProfile) {
      return 'articles';
    }
    
    return saved && ['drafts', 'articles', 'bookmarks'].includes(saved) 
      ? saved 
      : 'drafts';
  }

  /**
   * OPTIMIZED VERSION - Load profile data with better performance
   */
  async loadProfileDataOptimized(uid?: string) {
    this.loading = true;
    
    try {
      const currentUserId = this.authService.user?.uid || this.currentUser?.uid;
      const targetUid = uid || currentUserId;

      if (!targetUid) {
        console.error('No user ID available for profile loading');
        this.resetLoadingStates();
        return;
      }

      // PHASE 1: Load critical data first (profile + basic content)
      await this.loadCriticalData(targetUid);
      this.loading = false; // Show UI immediately

      // PHASE 2: Load stats and secondary data in background
      await this.loadSecondaryDataInBackground(targetUid);

    } catch (error) {
      console.error('Error loading profile:', error);
      this.userProfile = null;
      this.showNotification('Failed to load profile data', 'error');
      this.resetLoadingStates();
    }
  }

  /**
   * Load only essential data needed to show the UI
   */
  

  /**
   * Load content data (stories, drafts, bookmarks) efficiently
   */
  private async loadContentData(targetUid: string): Promise<{
    drafts: Story[];
    stories: Story[];
    bookmarks: Bookmark[];
  }> {
    if (this.isOwnProfile) {
      // For own profile, load all content types in parallel
      const [drafts, stories, bookmarks] = await Promise.all([
        this.storyService.getDraftsByAuthor(targetUid),
        this.storyService.getPublishedByAuthor(targetUid),
        this.bookmarkService.getUserBookmarks(targetUid)
      ]);
      return { drafts, stories, bookmarks };
    } else {
      // For other profiles, only load published stories
      const [stories, bookmarks] = await Promise.all([
        this.storyService.getPublishedByAuthor(targetUid),
        this.bookmarkService.getUserBookmarks(targetUid)
      ]);
      return { 
        drafts: [], 
        stories, 
        bookmarks 
      };
    }
  }

  /**
   * ENHANCED: Load non-critical data and automatically calculate XP/achievements
   */
  private async loadSecondaryDataInBackground(targetUid: string) {
    this.loadingStats = true;
    this.loadingBadges = true;

    try {
      // Load stats with caching
      const stats = await this.loadStatsWithCache(targetUid);
      
      // Update profile with real stats
      this.userProfile.nbViews = stats.totalViews;
      this.userProfile.nbUpvotes = stats.totalVotes;
      this.userProfile.nbFollowed = stats.followingCount;
      this.userProfile.nbFollowers = stats.followerCount;
      
      this.loadingStats = false;

      // AUTO-CALCULATE XP AND ACHIEVEMENTS
      if (this.isOwnProfile) {
        await this.processXPAndAchievements();
      } else {
        // For other profiles, just initialize badges for display
        this.initializeBadges();
        this.updateBadgeProgress();
        this.calculateXPProgress();
      }
      
      this.loadingBadges = false;

    } catch (error) {
      console.error('Error loading secondary data:', error);
      this.loadingStats = false;
      this.loadingBadges = false;
    }
  }

  /**
   * NEW: Process XP, streaks, and achievements automatically on profile load
   */
  private async processXPAndAchievements() {
    try {

      // 1. Update writing streak and award streak XP if applicable
      await this.updateWritingStreakOnLoad();

      // 2. Calculate XP progress for the UI
      this.calculateXPProgress();

      // 3. Initialize and update badges
      this.initializeBadges();
      this.updateBadgeProgress();


    } catch (error) {
      console.error('Error processing XP and achievements:', error);
    }
  }

  /**
   * NEW: Update writing streak on profile load (not just on write actions)
   */
  

  /**
   * NEW: Calculate XP progress for the progress bar
   */
 

  /**
   * Load stats with caching to avoid redundant API calls
   */
  private async loadStatsWithCache(targetUid: string): Promise<ProfileStats> {
    const cacheKey = `stats_${targetUid}`;
    const cached = this.statsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Load stats in parallel with optimized approach
    const [storyStats, followStats] = await Promise.all([
      this.loadStoryStatsOptimized(),
      this.loadFollowStats(targetUid)
    ]);

    const stats: ProfileStats = {
      totalViews: storyStats.totalViews,
      totalVotes: storyStats.totalVotes,
      followerCount: followStats.followers,
      followingCount: followStats.following
    };

    // Cache the results
    this.statsCache.set(cacheKey, {
      data: stats,
      timestamp: Date.now()
    });

    return stats;
  }

  /**
   * Optimized story stats loading - batch requests where possible
   */
  private async loadStoryStatsOptimized(): Promise<{
    totalViews: number;
    totalVotes: number;
  }> {
    if (this.stories.length === 0) {
      return { totalViews: 0, totalVotes: 0 };
    }

    // Process stories in chunks to avoid overwhelming the API
    const CHUNK_SIZE = 10;
    let totalViews = 0;
    let totalVotes = 0;

    for (let i = 0; i < this.stories.length; i += CHUNK_SIZE) {
      const chunk = this.stories.slice(i, i + CHUNK_SIZE);
      
      const chunkPromises = chunk.map(async (story) => {
        try {
          const [views, votes] = await Promise.all([
            this.viewsService.getViewCount(story.id),
            this.voteService.countVotes(story.id)
          ]);
          
          story.stats.readCount = views;
          story.stats.voteCount = votes;
          
          return { views, votes };
        } catch (error) {
          console.error('Error loading stats for story:', story.id, error);
          story.stats.readCount = 0;
          story.stats.voteCount = 0;
          return { views: 0, votes: 0 };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      
      chunkResults.forEach(result => {
        totalViews += result.views;
        totalVotes += result.votes;
      });

      // Add small delay between chunks to be nice to the API
      if (i + CHUNK_SIZE < this.stories.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return { totalViews, totalVotes };
  }

  /**
   * Load follow stats efficiently
   */
  private async loadFollowStats(targetUid: string): Promise<{
    followers: number;
    following: number;
  }> {
    try {
      const [followers, following] = await Promise.all([
        this.followService.getFollowers(targetUid),
        this.followService.getFollowing(targetUid)
      ]);
      
      return {
        followers: followers.length,
        following: following.length
      };
    } catch (error) {
      console.error('Error loading follow stats:', error);
      return { followers: 0, following: 0 };
    }
  }

  /**
   * Check follow status asynchronously
   */
  private async checkFollowStatus(targetUid: string) {
    if (!this.currentUser) return;
    
    try {
      this.isFollowing = await this.followService.isFollowing(
        this.currentUser.uid, 
        targetUid
      );
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  }

  private resetLoadingStates() {
    this.loading = false;
    this.loadingStats = false;
    this.loadingBadges = false;
  }

  /**
   * Invalidate cache when user performs actions that affect stats
   */
  private invalidateStatsCache(targetUid: string) {
    const cacheKey = `stats_${targetUid}`;
    this.statsCache.delete(cacheKey);
  }

  // Enhanced async operations with loading states
 

  async publishDraft(draft: Story) {
    if (!await this.confirmAction('publish-draft', draft.title)) return;
    
    this.deletingItem = draft.id;
    try {
      await this.storyService.updateStory(draft.id, { status: 'published' });
      await this.awardXP(25, 'Published a story');
      await this.updateWritingStreak();
      
      // Move from drafts to stories
      this.drafts = this.drafts.filter(d => d.id !== draft.id);
      this.stories.unshift({ ...draft, status: 'published' });
      
      this.showNotification('Draft published successfully!', 'success');
      
      // Invalidate cache
      if (this.currentUser) {
        this.invalidateStatsCache(this.currentUser.uid);
      }

      // Recalculate achievements
      this.updateBadgeProgress();
      this.calculateXPProgress();
    } catch (error) {
      console.error('Error publishing draft:', error);
      this.showNotification('Failed to publish draft', 'error');
    } finally {
      this.deletingItem = null;
    }
  }

  async toggleFollow() {
    if (!this.currentUser || !this.userProfile || this.isOwnProfile) return;

    const me = this.currentUser.uid;
    const them = this.userProfile.id;

    // Optimistic update - immediately update UI
    const wasFollowing = this.isFollowing;
    this.isFollowing = !this.isFollowing;
    this.userProfile.nbFollowers += this.isFollowing ? 1 : -1;
    
    this.followLoading = true;
    try {
      await this.followService.toggleFollow(me, them);
      if(this.isFollowing){this.notificationService.notifyNewFollower(them,this.currentUser.displayName,me)}
      this.showNotification(
        this.isFollowing ? 'Now following!' : 'Unfollowed',
        'success'
      );
      
      // Invalidate follow stats cache
      this.invalidateStatsCache(them);
    } catch (error) {
      // Revert optimistic update on error
      this.isFollowing = wasFollowing;
      this.userProfile.nbFollowers += wasFollowing ? 1 : -1;
      this.showNotification('Failed to update follow status. Please try again.', 'error');
      console.error('Error toggling follow:', error);
    } finally {
      this.followLoading = false;
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
      color: white;
      border-radius: 6px;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.style.opacity = '1', 100);
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
  }

  trackByFn(index: number, item: any): any {
    return item.id || index;
  }

  setActiveTab(tab: 'drafts' | 'articles' | 'bookmarks') {
    this.activeTab = tab;
    sessionStorage.setItem('profileActiveTab', tab);
  }

  async confirmAction(action: string, itemName: string): Promise<boolean> {
  const messages: any = {
    'delete-draft': `Delete "${itemName}" draft? This cannot be undone.`,
    'delete-story': `Delete "${itemName}" story? This will permanently remove it from your published articles and cannot be undone.`,
    'remove-bookmark': `Remove "${itemName}" from bookmarks?`,
  };
  
  return confirm(messages[action] || `Are you sure you want to ${action}?`);
}
  // Enhanced keyboard navigation
  onKeyDown(event: KeyboardEvent, action: string) {
    switch (action) {
      case 'name-edit':
        if (event.key === 'Enter') {
          event.preventDefault();
          this.saveName();
        } else if (event.key === 'Escape') {
          this.cancelNameEdit();
        }
        break;
      case 'bio-edit':
        if (event.key === 'Enter' && event.ctrlKey) {
          event.preventDefault();
          this.saveBio();
        } else if (event.key === 'Escape') {
          this.cancelBioEdit();
        }
        break;
    }
  }

  // Auto-save functionality
  onNameInput() {
    clearTimeout(this.nameSaveTimeout);
    this.nameSaveTimeout = setTimeout(() => {
      if (this.tempName !== (this.userProfile?.name || '') && this.tempName.trim()) {
        this.autoSaveName();
      }
    }, 2000);
  }

  onBioInput() {
    clearTimeout(this.bioSaveTimeout);
    this.bioSaveTimeout = setTimeout(() => {
      if (this.tempBio !== (this.userProfile?.bio || '')) {
        this.autoSaveBio();
      }
    }, 2000);
  }

  async autoSaveName() {
    try {
      await this.saveName();
    } catch (error) {
      this.showNotification('Failed to auto-save name', 'error');
    }
  }

  async autoSaveBio() {
    try {
      await this.saveBio();
    } catch (error) {
      this.showNotification('Failed to auto-save bio', 'error');
    }
  }

  // Enhanced empty states
  getEmptyStateMessage(tab: string): { title: string; subtitle: string; action?: string } {
    const messages : any = {
      'drafts': {
        title: 'No drafts yet',
        subtitle: 'Start writing your first draft to see it here.',
        action: 'Create Draft'
      },
      'articles': {
        title: this.isOwnProfile ? 'No published articles' : 'No articles yet',
        subtitle: this.isOwnProfile 
          ? 'Publish your first draft to see it here.' 
          : 'This user hasn\'t published any articles yet.'
      },
      'bookmarks': {
        title: 'No bookmarks yet',
        subtitle: 'Save interesting articles to read them later.'
      }
    };
    
    return messages[tab] || { title: 'Nothing here', subtitle: '' };
  }

  handleEmptyStateAction(tab: string) {
    switch (tab) {
      case 'drafts':
        this.createNewDraft();
        break;
      case 'articles':
        if (this.isOwnProfile) {
          this.router.navigate(['/write']);
        }
        break;
    }
  }

  

  private getCurrentDate(): string {
    const now = new Date();
    return now.toLocaleDateString('en-CA');
  }

  private getYesterdayDate(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toLocaleDateString('en-CA');
  }

  private formatDateForComparison(date: any): string {
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('en-CA');
  }

  private async awardStreakXP(currentStreak: number) {
    let xpAmount = 0;
    let reason = '';
    
    if (currentStreak % 30 === 0) {
      xpAmount = 200;
      reason = `Maintained ${currentStreak}-day writing streak (monthly milestone)`;
    } else if (currentStreak % 7 === 0) {
      xpAmount = 50;
      reason = `Maintained ${currentStreak}-day writing streak (weekly milestone)`;
    } else if (currentStreak === 1) {
      xpAmount = 10;
      reason = 'Started a new writing streak';
    } else {
      xpAmount = 5;
      reason = `Maintained ${currentStreak}-day writing streak`;
    }
    
    if (xpAmount > 0) {
      await this.awardXP(xpAmount, reason);
    }
  }

  private showStreakBrokenNotification(previousStreak: number) {
    if (previousStreak > 3) {
      this.showNotification(`Your ${previousStreak}-day writing streak was broken! Start a new one today!`, 'info');
    }
  }



  getStreakIcon(streak: number): string {
    if (streak >= 100) return '🏆';
    if (streak >= 30) return '🌟';
    if (streak >= 7) return '🔥';
    return '📅';
  }

  initializeBadges() {
    this.badges = [
      {
        id: 'first-draft',
        name: 'First Draft',
        description: 'Created your first draft',
        icon: '📝',
        unlocked: true
      },
      {
        id: 'first-publish',
        name: 'Author',
        description: 'Published your first story',
        icon: '📚',
        unlocked: false
      },
      {
        id: 'prolific-writer',
        name: 'Prolific Writer',
        description: 'Published 5 stories',
        icon: '✍️',
        unlocked: false,
        progress: 0,
        requirement: 5
      },
      {
        id: 'word-master',
        name: 'Word Master',
        description: 'Written 10,000 words total',
        icon: '📖',
        unlocked: false,
        progress: 0,
        requirement: 10000
      },
      {
        id: 'streak-novice',
        name: 'Consistent Writer',
        description: 'Maintained a 3-day writing streak',
        icon: '📅',
        unlocked: false,
        progress: 0,
        requirement: 3
      },
      {
        id: 'streak-warrior',
        name: 'Streak Warrior',
        description: 'Maintained a 7-day writing streak',
        icon: '🔥',
        unlocked: false,
        progress: 0,
        requirement: 7
      },
      {
        id: 'streak-champion',
        name: 'Streak Champion',
        description: 'Maintained a 30-day writing streak',
        icon: '🏆',
        unlocked: false,
        progress: 0,
        requirement: 30
      },
      {
        id: 'streak-legend',
        name: 'Writing Legend',
        description: 'Maintained a 100-day writing streak',
        icon: '🌟',
        unlocked: false,
        progress: 0,
        requirement: 100
      },
      {
        id: 'community-favorite',
        name: 'Community Favorite',
        description: 'Received 100 total votes',
        icon: '⭐',
        unlocked: false,
        progress: 0,
        requirement: 100
      },
      {
        id: 'bookworm',
        name: 'Bookworm',
        description: 'Bookmarked 20 stories',
        icon: '🔖',
        unlocked: false,
        progress: 0,
        requirement: 20
      }
    ];
    this.badgesInitialized = true;
  }

  updateBadgeProgress() {
    if (!this.userProfile || !this.badgesInitialized) return;

    const totalVotes = this.calculateTotalVotes();
    let badgesUnlocked = 0;

    this.badges.forEach(badge => {
      const wasUnlocked = badge.unlocked;
      
      switch (badge.id) {
        case 'first-draft':
          badge.unlocked = this.drafts.length > 0 || this.stories.length > 0;
          break;
        case 'first-publish':
          badge.unlocked = (this.stories.length || 0) > 0;
          break;
        case 'prolific-writer':
          badge.progress = Math.min(this.stories.length || 0, badge.requirement!);
          badge.unlocked = (this.stories.length || 0) >= badge.requirement!;
          break;
        case 'word-master':
  const totalWords = this.calculateTotalWords();
  badge.progress = Math.min(totalWords, badge.requirement!);
  badge.unlocked = totalWords >= badge.requirement!;
  break;

        case 'streak-novice':
        case 'streak-warrior':
        case 'streak-champion':
        case 'streak-legend':
          const currentStreak = this.isStreakCurrent() ? this.userProfile?.writingStreak || 0 : 0;
          badge.progress = Math.min(currentStreak, badge.requirement!);
          badge.unlocked = currentStreak >= badge.requirement!;
          break;
        case 'community-favorite':
          badge.progress = Math.min(totalVotes, badge.requirement!);
          badge.unlocked = totalVotes >= badge.requirement!;
          break;
        case 'bookworm':
          badge.progress = Math.min(this.bookmarks.length || 0, badge.requirement!);
          badge.unlocked = (this.bookmarks.length || 0) >= badge.requirement!;
          break;
      }

      // Count newly unlocked badges
      if (badge.unlocked && !wasUnlocked) {
        badgesUnlocked++;
      }
    });

    // Show notification for newly unlocked badges
    if (badgesUnlocked > 0 && this.isOwnProfile) {
      const message = badgesUnlocked === 1 
        ? 'New achievement unlocked!' 
        : `${badgesUnlocked} new achievements unlocked!`;
      this.showNotification(message, 'success');
    }

  }

  calculateTotalVotes(): number {
    return this.stories.reduce((total, story) => {
      return total + (story.stats.voteCount || 0);
    }, 0);
  }

  calculateTotalViews(): number {
    return this.stories.reduce((total, story) => {
      return total + (story.stats.readCount || 0);
    }, 0);
  }

// Add these to your component for enhanced display
getXPStatusText(): string {
  if (!this.userProfile) return '';
  
  const currentXP = this.userProfile.xp || 0;
  const currentLevel = this.userProfile.level || 1;
  const xpNeeded = this.getXPNeededForNextLevel();
  
  return `Level ${currentLevel} • ${currentXP} XP • ${xpNeeded} to next level`;
}

// For showing detailed XP info on hover/click
getDetailedXPInfo(): string {
  if (!this.userProfile) return '';
  
  const currentXP = this.userProfile.xp || 0;
  const currentLevel = this.userProfile.level || 1;
  const currentLevelXP = this.getLevelXP(currentLevel);
  const nextLevelXP = this.getNextLevelXP();
  const progressInLevel = currentXP - currentLevelXP;
  const totalNeededForLevel = nextLevelXP - currentLevelXP;
  
  return `${progressInLevel}/${totalNeededForLevel} XP in Level ${currentLevel}`;
}
  



  /**
   * NEW: Get XP needed for next level
   */
 

  getMotivationMessage(): string {
    if (!this.userProfile || !this.isOwnProfile) return '';

    const currentStreak = this.userProfile.writingStreak || 0;
    const unlockedBadges = this.badges.filter(b => b.unlocked).length;
    const totalBadges = this.badges.length;

    if (currentStreak > 0) {
      if (this.isStreakCurrent()) {
        if (currentStreak === 1) {
          return "You started a streak! Write again tomorrow to keep it going!";
        } else if (currentStreak < 3) {
          return `Keep your ${currentStreak}-day streak alive! ${3 - currentStreak} more days until your first streak badge!`;
        } else if (currentStreak < 7) {
          return `Keep your ${currentStreak}-day streak alive! ${7 - currentStreak} more days until Streak Warrior!`;
        } else if (currentStreak < 30) {
          return `Amazing ${currentStreak}-day streak! ${30 - currentStreak} more days until Streak Champion!`;
        } else if (currentStreak < 100) {
          return `Incredible ${currentStreak}-day streak! ${100 - currentStreak} more days until Writing Legend!`;
        } else {
          return `You're a Writing Legend with ${currentStreak} days! Keep the momentum going!`;
        }
      } else {
        return "Your streak is about to break! Write something today to keep it going!";
      }
    }

    const nearAchievements = this.badges.filter(badge => 
      !badge.unlocked && 
      badge.progress !== undefined && 
      badge.requirement !== undefined
    ).sort((a, b) => {
      if (a.id.includes('streak')) return -1;
      if (b.id.includes('streak')) return 1;
      return (b.progress! / b.requirement!) - (a.progress! / a.requirement!);
    });

    if (nearAchievements.length > 0) {
      const badge = nearAchievements[0];
      const progressPercentage = (badge.progress! / badge.requirement!) * 100;
      
      if (progressPercentage >= 80) {
        const remaining = badge.requirement! - badge.progress!;
        return `You're ${remaining} away from "${badge.name}"! ${this.getBadgeHint(badge.id)}`;
      }
    }

    if (this.drafts.length === 0) {
      return "Start a writing streak today! Create your first draft!";
    }

    if (this.stories.length === 0 && this.drafts.length > 0) {
      return "Publish a draft to start building your writing reputation!";
    }

    if (unlockedBadges < totalBadges) {
      return `${totalBadges - unlockedBadges} achievements waiting! Consistency is key.`;
    }

    return "Keep up the great work! Your consistency is inspiring.";
  }

  private getBadgeHint(badgeId: string): string {
    const hints: { [key: string]: string } = {
      'streak-novice': 'Write for 3 consecutive days!',
      'streak-warrior': 'Write every day for a full week!',
      'streak-champion': 'Maintain your daily writing for a month!',
      'streak-legend': 'The ultimate challenge - 100 days of writing!',
      'prolific-writer': 'Publish more stories to reach your goal!',
      'word-master': 'Keep writing - every word counts!',
      'community-favorite': 'Engage with the community to get more votes!',
      'bookworm': 'Discover and bookmark great content!'
    };
    
    return hints[badgeId] || '';
  }

  formatNumber(num: number | null | undefined): string {
    if (num === null || num === undefined) return "0";

    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + "M";
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1) + "K";
    }
    return num.toString();
  }

  startEditingName() {
    if (!this.isOwnProfile) return;
    
    this.editingName = true;
    this.tempName = this.userProfile?.displayName || '';
    setTimeout(() => {
      this.nameInput?.nativeElement?.focus();
    });
  }

  async saveName() {
    if (!this.userProfile || !this.tempName.trim() || !this.isOwnProfile) return;
    
    this.savingProfile = true;
    try {
        if (this.currentUser) {
            await this.profileService.updateProfile(this.currentUser.uid, {
              name: this.tempName.trim()
            });
      }
      
      if (this.userProfile) {
        this.userProfile.displayName = this.tempName.trim();
      }
      this.editingName = false;
      this.showNotification('Name updated successfully', 'success');
    } catch (error) {
      console.error('Error updating name:', error);
      this.showNotification('Failed to update name', 'error');
    } finally {
      this.savingProfile = false;
    }
  }

  cancelNameEdit() {
    this.editingName = false;
    this.tempName = '';
  }

  startEditingBio() {
    if (!this.isOwnProfile) return;
    
    this.editingBio = true;
    this.tempBio = this.userProfile?.bio || '';
    setTimeout(() => {
      this.bioInput?.nativeElement?.focus();
    });
  }

  async saveBio() {
    if (!this.userProfile || !this.isOwnProfile) return;
    
    this.savingProfile = true;
    try {
        if (this.currentUser) {
      await this.profileService.updateProfile(this.currentUser.uid, {
        bio: this.tempBio.trim()
      });}
      
      if (this.userProfile) {
        this.userProfile.bio = this.tempBio.trim();
      }
      this.editingBio = false;
      this.showNotification('Bio updated successfully', 'success');
    } catch (error) {
      console.error('Error updating bio:', error);
      this.showNotification('Failed to update bio', 'error');
    } finally {
      this.savingProfile = false;
    }
  }

  cancelBioEdit() {
    this.editingBio = false;
    this.tempBio = '';
  }

  async createNewDraft() {
    try {
      this.router.navigate(['/write']);
      
      // Recalculate progress
      this.calculateXPProgress();
      this.updateBadgeProgress();
    } catch (error) {
      console.error('Error creating new draft:', error);
      this.showNotification('Failed to create draft', 'error');
    }
  }

  editDraft(draft: Story) {
    this.router.navigate(['/write', draft.id]);
  }

  readBookmark(bookmark: Bookmark) {
    if(bookmark.storyId) {
      this.router.navigate(['/story/', bookmark.storyId]);
    }
  }

  editBookmark(bookmark: Bookmark) {
  }

  
 
 

  formatDate(date: any): string {
  if (!date) return '';
  
  const dateObj = date.toDate ? date.toDate() : new Date(date);
  const now = new Date();

  const diffTime = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

  getExcerpt(content: string, maxLength = 150): string {
    if (!content) return '';
    
    const plainText = content.replace(/<[^>]*>/g, '');
    return plainText.length > maxLength 
      ? plainText.substring(0, maxLength) + '...'
      : plainText;
  }

  calculateReadTime(content: string): number {
    if (!content) return 0;
    
    const words = content.trim().split(/\s+/).length;
    return Math.ceil(words / 200);
  }

  get unlockedBadgesCount(): number {
  return this.badges ? this.badges.filter(b => b.unlocked).length : 0;
}

get totalBadgesCount(): number {
  return this.badges ? this.badges.length : 0;
}












// Add this method to calculate the last write day from actual stories

private calculateLastWriteDayFromStories(): Date | null {
  if (!this.stories || this.stories.length === 0) return null;

  const storyDates = this.stories
    .filter(story => story.status === 'published' && story.createdAt)
    .map(story => {
      const createdAt = story.createdAt;

      if (createdAt instanceof Date) {
        return createdAt;
      } else if (createdAt instanceof Timestamp) {
        return createdAt.toDate();
      } else {
        return new Date(createdAt); // assume ISO string
      }
    })
    .sort((a, b) => b.getTime() - a.getTime());

  return storyDates.length > 0 ? storyDates[0] : null;
}


// Update the calculateWritingStreakFromStories method
private calculateWritingStreakFromStories(): number {
  if (!this.stories || this.stories.length === 0) return 0;
  
  // Get all story dates sorted by most recent
  const storyDates = this.stories
    .filter(story => story.status === 'published' && story.createdAt)
    .map(story => {
      const date = story.createdAt ? story.createdAt : new Date(story.createdAt);
      return this.formatDateForComparison(date);
    })
    .sort()
    .reverse(); // Most recent first
  
  if (storyDates.length === 0) return 0;
  
  const today = this.getCurrentDate();
  const yesterday = this.getYesterdayDate();
  
  // Check if user wrote today or yesterday to have an active streak
  const mostRecentWrite = storyDates[0];
  if (mostRecentWrite !== today && mostRecentWrite !== yesterday) {
    return 0; // Streak is broken
  }
  
  // Calculate consecutive days
  let streak = 0;
  const uniqueDates = [...new Set(storyDates)]; // Remove duplicates (multiple stories same day)
  
  let currentDate = mostRecentWrite === today ? today : yesterday;
  
  for (const storyDate of uniqueDates) {
    if (storyDate === currentDate) {
      streak++;
      // Move to previous day
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);
      currentDate = prevDate.toLocaleDateString('en-CA');
    } else {
      break; // Streak broken
    }
  }
  
  return streak;
}

// Update the loadCriticalData method to use story-based calculations
private async loadCriticalData(targetUid: string) {
  // Load profile and content in parallel
  const [profile, contentData] = await Promise.all([
    this.profileService.getProfile(targetUid),
    this.loadContentData(targetUid)
  ]);

  if (!profile) {
    throw new Error('Profile not found');
  }

  // Set content immediately
  this.drafts = contentData.drafts;
  this.stories = contentData.stories;
  this.bookmarks = contentData.bookmarks;

  // Calculate writing data from actual stories
  const lastWriteDay = this.calculateLastWriteDayFromStories();
  const writingStreak = this.calculateWritingStreakFromStories();

  // Set up profile with story-based writing data
  this.userProfile = {
    ...profile,
    nbUpvotes: 0,
    nbViews: 0,
    nbFollowed: 0,
    nbFollowers: 0,
    xp: profile.xp || 0,
    level: profile.level || 1,
    writingStreak: writingStreak,
    lastWriteDate: lastWriteDay ? lastWriteDay.toISOString() : null
  };

  // Check follow status immediately if needed (non-blocking)
  if (!this.isOwnProfile && this.currentUser) {
    this.checkFollowStatus(targetUid);
  }
}

// Update the updateWritingStreak method to work with story-based data
async updateWritingStreak() {
  if (!this.currentUser || !this.isOwnProfile || !this.userProfile) return;
  
  try {
    // Recalculate streak from stories after a new publish
    const newStreak = this.calculateWritingStreakFromStories();
    const lastWriteDay = this.calculateLastWriteDayFromStories();
    
    // Update the profile with calculated values
    if (this.currentUser) {
      await this.profileService.updateProfile(this.currentUser.uid, {
        streaks: newStreak,
        lastWriteDay: lastWriteDay || new Date()
      });
    }

    const oldStreak = this.userProfile.writingStreak || 0;
    this.userProfile.writingStreak = newStreak;
    this.userProfile.lastWriteDate = lastWriteDay ? lastWriteDay.toISOString() : null;

    // Award streak XP for improvements
    if (newStreak > oldStreak) {
      await this.awardStreakXP(newStreak);
    }
    
  } catch (error) {
    console.error('Error updating writing streak:', error);
  }
}

// Update the updateWritingStreakOnLoad method
private async updateWritingStreakOnLoad() {
  if (!this.currentUser || !this.userProfile) return;

  try {
    // Calculate current streak from stories
    const calculatedStreak = this.calculateWritingStreakFromStories();
    const lastWriteDay = this.calculateLastWriteDayFromStories();
    

    // Update profile if the calculated values differ from stored values
    const storedStreak = this.userProfile.writingStreak || 0;
    
    if (calculatedStreak !== storedStreak) {
      await this.profileService.updateProfile(this.currentUser.uid, {
        streaks: calculatedStreak,
        lastWriteDay: lastWriteDay || new Date()
      });

      // Show notification if streak was broken
      if (calculatedStreak === 0 && storedStreak > 0) {
        this.showStreakBrokenNotification(storedStreak);
      }
      
      this.userProfile.writingStreak = calculatedStreak;
      this.userProfile.lastWriteDate = lastWriteDay ? lastWriteDay.toISOString() : null;
      this.streakUpdated = true;
    }

  } catch (error) {
    console.error('Error updating writing streak on load:', error);
  }
}

// Helper method to check if streak is current based on stories
isStreakCurrent(): boolean {
  const lastWriteDay = this.calculateLastWriteDayFromStories();
  if (!lastWriteDay) return false;
  
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const lastWriteDateStr = this.formatDateForComparison(lastWriteDay);
  const todayStr = this.getCurrentDate();
  const yesterdayStr = this.getYesterdayDate();
  
  return lastWriteDateStr === todayStr || lastWriteDateStr === yesterdayStr;
}

private calculateWordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}


private calculateTotalWords(): number {
  const allStories = [...this.stories, ...this.drafts];
  return allStories.reduce((total, story) => {
    const content = (story as any).content || '';
    return total + this.calculateWordCount(content);
  }, 0);
}


// Replace these methods in your Profile component with the corrected versions:

/**
 * Calculate the total XP required to reach a specific level
 * Level 1: 0 XP, Level 2: 100 XP, Level 3: 400 XP, Level 4: 900 XP, etc.
 */
getLevelXP(level: number): number {
  if (level <= 1) return 0;
  return (level - 1) * (level - 1) * 100;
}

/**
 * Calculate current level from total XP
 * Inverse of getLevelXP function
 */
calculateLevel(totalXP: number): number {
  if (totalXP <= 0) return 1;
  return Math.floor(Math.sqrt(totalXP / 100)) + 1;
}

/**
 * Get XP required for the next level
 */
getNextLevelXP(): number {
  const currentLevel = this.userProfile?.level || 1;
  return this.getLevelXP(currentLevel + 1);
}

/**
 * Calculate XP progress percentage within current level
 */
getXPProgress(): number {
  if (!this.userProfile) return 0;
  
  const currentXP = this.userProfile.xp || 0;
  const currentLevel = this.userProfile.level || 1;
  const currentLevelXP = this.getLevelXP(currentLevel);
  const nextLevelXP = this.getLevelXP(currentLevel + 1);
  
  // XP range for current level
  const levelXPRange = nextLevelXP - currentLevelXP;
  const currentLevelProgress = currentXP - currentLevelXP;
  
  return Math.max(0, Math.min(100, (currentLevelProgress / levelXPRange) * 100));
}

/**
 * Get XP needed for next level
 */
getXPNeededForNextLevel(): number {
  if (!this.userProfile) return 100;
  const currentXP = this.userProfile.xp || 0;
  const nextLevelXP = this.getNextLevelXP();
  return Math.max(0, nextLevelXP - currentXP);
}

/**
 * Get XP range for current level (how much XP this level requires)
 */
getCurrentLevelXPRange(): number {
  const currentLevel = this.userProfile?.level || 1;
  const currentLevelXP = this.getLevelXP(currentLevel);
  const nextLevelXP = this.getLevelXP(currentLevel + 1);
  return nextLevelXP - currentLevelXP;
}

/**
 * Calculate XP progress for the UI with proper level boundaries
 */
private calculateXPProgress() {
  if (!this.userProfile) return;

  const currentXP = this.userProfile.xp || 0;
  const currentLevel = this.calculateLevel(currentXP); // Ensure level matches XP
  
  // Update level if it doesn't match calculated level
  if (this.userProfile.level !== currentLevel) {
    this.userProfile.level = currentLevel;
  }
  
  this.currentLevelXP = this.getLevelXP(currentLevel);
  this.nextLevelXP = this.getLevelXP(currentLevel + 1);
  this.xpProgress = this.getXPProgress();


}

/**
 * Award XP and handle level ups properly
 */
async awardXP(amount: number, reason: string) {
  if (!this.currentUser || !this.userProfile) return;
  
  try {
    const oldLevel = this.userProfile.level || 1;
    const oldXP = this.userProfile.xp || 0;
    const newXP = oldXP + amount;
    const newLevel = this.calculateLevel(newXP);
    
    // Update profile service
    await this.profileService.awardUserXP(this.currentUser.uid, amount, reason);
    
    // Update local profile
    this.userProfile.xp = newXP;
    this.userProfile.level = newLevel;
    
    // Recalculate XP progress
    this.calculateXPProgress();
    
    // Show level up notification if applicable
    if (newLevel > oldLevel) {
      this.showLevelUpNotification(newLevel, oldLevel);
      
    }

  } catch (error) {
    console.error('Error awarding XP:', error);
  }
}

/**
 * Enhanced level up notification
 */
showLevelUpNotification(newLevel: number, oldLevel: number) {
  const levelGain = newLevel - oldLevel;
  const message = levelGain === 1 
    ? `Level up! You're now level ${newLevel}!`
    : `Amazing! You jumped ${levelGain} levels to level ${newLevel}!`;
  
  this.showNotification(message, 'success');
}

/**
 * Get a formatted display of current XP status
 */


/**
 * Debug method to verify XP system consistency
 */
debugXPSystem() {
  for (let level = 1; level <= 10; level++) {
    const requiredXP = this.getLevelXP(level);
    const calculatedLevel = this.calculateLevel(requiredXP);
    const nextLevelXP = this.getLevelXP(level + 1);
    const xpForThisLevel = nextLevelXP - requiredXP;
    
  }
}



async deleteDraft(draft: Story) {
  if (!await this.confirmAction('delete-draft', draft.title)) return;
  
  this.deletingItem = draft.id;
  try {
    await this.storyService.deleteDraft(draft.id);
    this.drafts = this.drafts.filter(d => d.id !== draft.id);
    this.showNotification('Draft deleted successfully', 'success');
    
    // Invalidate cache since stats might change
    if (this.currentUser) {
      this.invalidateStatsCache(this.currentUser.uid);
    }
  } catch (error) {
    console.error('Error deleting draft:', error);
    this.showNotification('Failed to delete draft', 'error');
  } finally {
    this.deletingItem = null;
  }
}

// New method to delete published stories
async deleteStory(story: Story) {
  if (!await this.confirmAction('delete-story', story.title)) return;
  
  this.deletingItem = story.id;
  try {
    await this.storyService.deleteStory(story.id);
    this.stories = this.stories.filter(s => s.id !== story.id);
    this.showNotification('Story deleted successfully', 'success');
    
    // Invalidate cache since stats might change
    if (this.currentUser) {
      this.invalidateStatsCache(this.currentUser.uid);
    }

    // Recalculate achievements and XP as content has changed
    this.updateBadgeProgress();
    this.calculateXPProgress();
  } catch (error) {
    console.error('Error deleting story:', error);
    this.showNotification('Failed to delete story', 'error');
  } finally {
    this.deletingItem = null;
  }
}






// Add these properties to your Profile component class

// Social links edit state
editingSocial = false;
tempSocialLinks: { fb?: string; ig?: string; linkedin?: string } = {};

// Add these methods to your Profile component class

/**
 * Check if user has any social links
 */
hasSocialLinks(): boolean {
  if (!this.userProfile?.socialLinks) return false;
  
  const links = this.userProfile.socialLinks;
  return !!(links.fb || links.ig || links.linkedin);
}

/**
 * Start editing social links
 */
startEditingSocial() {
  if (!this.isOwnProfile) return;
  
  this.editingSocial = true;
  this.tempSocialLinks = {
    fb: this.userProfile?.socialLinks?.fb || '',
    ig: this.userProfile?.socialLinks?.ig || '',
    linkedin: this.userProfile?.socialLinks?.linkedin || ''
  };
}

/**
 * Save social links with validation
 */
async saveSocialLinks() {
  if (!this.userProfile || !this.isOwnProfile) return;
  
  this.savingProfile = true;
  try {
    // Validate and clean the links
    const cleanedLinks = this.validateAndCleanSocialLinks(this.tempSocialLinks);
    
    // Update profile
    if (this.currentUser) {
      await this.profileService.updateProfile(this.currentUser.uid, {
        socialLinks: cleanedLinks
      });
    }
    
    // Update local profile
    this.userProfile.socialLinks = cleanedLinks;
    this.editingSocial = false;
    
    this.showNotification('Social links updated successfully', 'success');
  } catch (error) {
    console.error('Error updating social links:', error);
    this.showNotification('Failed to update social links', 'error');
  } finally {
    this.savingProfile = false;
  }
}

/**
 * Cancel social links editing
 */
cancelSocialEdit() {
  this.editingSocial = false;
  this.tempSocialLinks = {};
}

/**
 * Validate and clean social links
 */
private validateAndCleanSocialLinks(links: { fb?: string; ig?: string; linkedin?: string }): { fb?: string; ig?: string; linkedin?: string } {
  const cleaned: { fb?: string; ig?: string; linkedin?: string } = {};
  
  // Facebook validation and cleaning
  if (links.fb && links.fb.trim()) {
    cleaned.fb = this.cleanSocialLink(links.fb.trim(), 'facebook');
  }
  
  // Instagram validation and cleaning
  if (links.ig && links.ig.trim()) {
    cleaned.ig = this.cleanSocialLink(links.ig.trim(), 'instagram');
  }
  
  // LinkedIn validation and cleaning
  if (links.linkedin && links.linkedin.trim()) {
    cleaned.linkedin = this.cleanSocialLink(links.linkedin.trim(), 'linkedin');
  }
  
  return cleaned;
}

/**
 * Clean and normalize a social media link
 */
private cleanSocialLink(input: string, platform: 'facebook' | 'instagram' | 'linkedin'): string {
  // Remove any existing protocol and www
  let cleaned = input.replace(/^https?:\/\/(www\.)?/, '');
  
  // Remove trailing slashes
  cleaned = cleaned.replace(/\/+$/, '');
  
  switch (platform) {
    case 'facebook':
      // Handle @username format
      if (cleaned.startsWith('@')) {
        return cleaned.substring(1);
      }
      // Handle facebook.com/username format
      if (cleaned.startsWith('facebook.com/')) {
        return cleaned.substring('facebook.com/'.length);
      }
      // Handle m.facebook.com format
      if (cleaned.startsWith('m.facebook.com/')) {
        return cleaned.substring('m.facebook.com/'.length);
      }
      // Return as-is if it looks like a username
      return cleaned;
      
    case 'instagram':
      // Handle @username format
      if (cleaned.startsWith('@')) {
        return cleaned.substring(1);
      }
      // Handle instagram.com/username format
      if (cleaned.startsWith('instagram.com/')) {
        return cleaned.substring('instagram.com/'.length);
      }
      // Return as-is if it looks like a username
      return cleaned;
      
    case 'linkedin':
      // Handle linkedin.com/in/username format
      if (cleaned.startsWith('linkedin.com/in/')) {
        return cleaned.substring('linkedin.com/in/'.length);
      }
      // Handle linkedin.com/company/company format
      if (cleaned.startsWith('linkedin.com/company/')) {
        return cleaned.substring('linkedin.com/company/'.length);
      }
      // Handle linkedin.com/username format
      if (cleaned.startsWith('linkedin.com/')) {
        return cleaned.substring('linkedin.com/'.length);
      }
      // Return as-is
      return cleaned;
      
    default:
      return cleaned;
  }
}

/**
 * Generate full social media URL from stored value
 */
getSocialUrl(platform: 'fb' | 'ig' | 'linkedin', value: string): string {
  if (!value) return '#';
  
  // If it's already a full URL, return as-is
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  
  switch (platform) {
    case 'fb':
      return `https://facebook.com/${value}`;
    case 'ig':
      return `https://instagram.com/${value}`;
    case 'linkedin':
      // Try to determine if it's a personal profile or company page
      if (value.includes('/company/') || this.isCompanyLinkedIn(value)) {
        return `https://linkedin.com/company/${value}`;
      } else {
        return `https://linkedin.com/in/${value}`;
      }
    default:
      return '#';
  }
}

/**
 * Heuristic to determine if a LinkedIn profile is a company page
 */
private isCompanyLinkedIn(value: string): boolean {
  const companyIndicators = [
    'company', 'corp', 'inc', 'ltd', 'llc', 'technologies', 
    'solutions', 'services', 'consulting', 'group'
  ];
  
  const lowerValue = value.toLowerCase();
  return companyIndicators.some(indicator => lowerValue.includes(indicator));
}

/**
 * Validate individual social link format (for real-time validation)
 */
validateSocialLink(platform: 'fb' | 'ig' | 'linkedin', value: string): { valid: boolean; message?: string } {
  if (!value || !value.trim()) {
    return { valid: true }; // Empty is valid (optional field)
  }
  
  const trimmed = value.trim();
  
  // Basic length check
  if (trimmed.length > 100) {
    return { valid: false, message: 'Link is too long' };
  }
  
  switch (platform) {
    case 'fb':
      if (this.containsInvalidChars(trimmed, 'facebook')) {
        return { valid: false, message: 'Invalid characters in Facebook link' };
      }
      break;
      
    case 'ig':
      if (this.containsInvalidChars(trimmed, 'instagram')) {
        return { valid: false, message: 'Invalid characters in Instagram link' };
      }
      break;
      
    case 'linkedin':
      if (this.containsInvalidChars(trimmed, 'linkedin')) {
        return { valid: false, message: 'Invalid characters in LinkedIn link' };
      }
      break;
  }
  
  return { valid: true };
}

/**
 * Check for invalid characters in social media usernames/links
 */
private containsInvalidChars(value: string, platform: string): boolean {
  // Remove common prefixes for validation
  let cleanValue = value.replace(/^https?:\/\/(www\.|m\.)?/, '');
  cleanValue = cleanValue.replace(/^@/, '');
  cleanValue = cleanValue.replace(new RegExp(`^${platform}\.com\/`), '');
  
  // Check for invalid characters (basic validation)
  const invalidChars = /[<>{}|\\^`\[\]]/;
  return invalidChars.test(cleanValue);
}

/**
 * Get social link display text
 */
getSocialDisplayText(platform: 'facebook' | 'instagram' | 'linkedin', value: string): string {
  if (!value) return '';
  
  // If it's already a clean username, return with @
  if (!value.includes('/') && !value.includes('.')) {
    return `@${value}`;
  }
  
  // Extract username from URL format
  const cleaned = this.cleanSocialLink(value, platform);
  return cleaned.length > 20 ? `@${cleaned.substring(0, 17)}...` : `@${cleaned}`;
}
editingSingleSocial: string | null | any = null;

editSingleSocial(platform: 'fb' | 'ig' | 'linkedin') {
  if (!this.isOwnProfile) return;
  
  this.editingSocial = true;
  this.editingSingleSocial = platform;
  this.tempSocialLinks = {
    fb: platform === 'fb' ? (this.userProfile?.socialLinks?.fb || '') : '',
    ig: platform === 'ig' ? (this.userProfile?.socialLinks?.ig || '') : '',
    linkedin: platform === 'linkedin' ? (this.userProfile?.socialLinks?.linkedin || '') : ''
  };
}


clearSocialInput(platform: 'fb' | 'ig' | 'linkedin') {
  this.tempSocialLinks[platform] = '';
}


private getSocialPlatformName(platform: 'fb' | 'ig' | 'linkedin'): string {
  const names = {
    fb: 'Facebook',
    ig: 'Instagram',
    linkedin: 'LinkedIn'
  };
  return names[platform];
}
/**
 * Delete a specific social link
 */
async deleteSocialLink(platform: 'fb' | 'ig' | 'linkedin') {
  if (!this.isOwnProfile || !this.userProfile?.socialLinks) return;
  
  if (!confirm(`Remove your ${this.getSocialPlatformName(platform)} link?`)) return;
  
  this.savingProfile = true;
  try {
    const updatedLinks = { ...this.userProfile.socialLinks };
    delete updatedLinks[platform];
    
    if (this.currentUser) {
      await this.profileService.updateProfile(this.currentUser.uid, {
        socialLinks: updatedLinks
      });
    }
    
    this.userProfile.socialLinks = updatedLinks;
    this.editingSocial = false;
    this.editingSingleSocial = null;
    
    this.showNotification('Social link removed successfully', 'success');
  } catch (error) {
    console.error('Error deleting social link:', error);
    this.showNotification('Failed to remove social link', 'error');
  } finally {
    this.savingProfile = false;
  }
}


canAddMoreSocials(): boolean {
  if (!this.userProfile?.socialLinks) return true;
  
  const links = this.userProfile.socialLinks;
  const currentCount = [links.fb, links.ig, links.linkedin].filter(Boolean).length;
  return currentCount < 3; // Maximum 3 social links
}

/**
 * Handle social link input changes for real-time validation (optional)
 */
onSocialInputChange(platform: 'fb' | 'ig' | 'linkedin', event: Event) {
  const input = event.target as HTMLInputElement;
  const validation = this.validateSocialLink(platform, input.value);
  
  // Add visual feedback classes
  input.classList.remove('valid', 'invalid');
  if (input.value.trim()) {
    input.classList.add(validation.valid ? 'valid' : 'invalid');
  }
  
  // You could also show validation messages here
}
}