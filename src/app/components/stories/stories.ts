import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Story, Bookmark } from '../../models';
import { StoryStatus } from '../../models/firestore';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';
import { CommentService } from '../../services/comment.service';
import { StoryService } from '../../services/story.service';
import { VoteService } from '../../services/vote.service';
import { FormsModule } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { BookmarkService } from '../../services/bookmark.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-stories',
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './stories.html',
  styleUrl: './stories.scss'
})
export class Stories implements OnInit, OnDestroy {
  private storyService = inject(StoryService);
  private voteService = inject(VoteService);
  private commentService = inject(CommentService);
  private bookmarkService = inject(BookmarkService);
  private authService = inject(AuthService);
  private profileService = inject(ProfileService); 
  private destroy$ = new Subject<void>();

  // State management
  stories: Story[] = [];
  isLoading = true;
  isLoadingMore = false;
  isLoadingStats = false;
  errorMessage = '';
  hasMoreStories = true;
  currentUser: any = null;

  // Pagination
  storiesPerPage = 20;
  currentPage = 1;

  // Filtering and sorting
  searchQuery = '';
  selectedCategory = '';
  selectedLanguage = '';
  sortType: 'newest' | 'oldest' | 'az' | 'popular' | 'trending' = 'newest';

  // Computed properties
  availableCategories: string[] = [];
  private userBookmarks: Bookmark[] = [];
  private bookmarkedStories = new Set<string>();

  // Performance optimization - caching
  private statsCache = new Map<string, { votes: number; comments: number; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private debounceTimeout?: number;

  // Batch processing
  private pendingStatsRequests = new Set<string>();
  private statsRequestQueue: string[] = [];

  ngOnInit() {
    this.setupAuthSubscription();
    this.loadStoriesOptimized();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
  }

  private setupAuthSubscription() {
    this.authService.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.loadUserBookmarks();
        } else {
          this.bookmarkedStories.clear();
          this.userBookmarks = [];
        }
      });
  }

  /**
   * OPTIMIZED VERSION - Load stories with better performance
   */
  async loadStoriesOptimized(append = false) {
    try {
      if (!append) {
        this.isLoading = true;
        this.errorMessage = '';
        this.storyService.resetPagination();
      } else {
        this.isLoadingMore = true;
      }

      // Phase 1: Load basic story data first (fast)
      const rawStories = await this.storyService.getStories(this.storiesPerPage, append);
      
      if (rawStories.length < this.storiesPerPage) {
        this.hasMoreStories = false;
      }

      // Add stories with placeholder stats immediately
      const storiesWithPlaceholderStats = rawStories.map(story => ({
        ...story,
        stats: {
          ...story.stats,
          voteCount: story.stats.voteCount || 0,
          commentCount: story.stats.commentCount || 0,
        }
      }));

      // Update UI immediately
      if (append) {
        this.stories = [...this.stories, ...storiesWithPlaceholderStats];
      } else {
        this.stories = storiesWithPlaceholderStats;
      }

      this.updateAvailableCategories();
      this.isLoading = false;
      this.isLoadingMore = false;

      // Phase 2: Load stats in the background (slower)
      this.loadStatsInBackground(rawStories);

    } catch (error) {
      console.error('Error loading stories:', error);
      this.errorMessage = 'Failed to load stories. Please try again later.';
      this.isLoading = false;
      this.isLoadingMore = false;
    }
  }

  /**
   * Load stats for stories in the background after UI is shown
   */
  private async loadStatsInBackground(newStories: Story[]) {
    this.isLoadingStats = true;
    
    try {
      // Process in smaller chunks to avoid overwhelming the API
      const CHUNK_SIZE = 5;
      
      for (let i = 0; i < newStories.length; i += CHUNK_SIZE) {
        const chunk = newStories.slice(i, i + CHUNK_SIZE);
        await this.loadStatsForChunk(chunk);
        
        // Small delay between chunks
        if (i + CHUNK_SIZE < newStories.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      this.isLoadingStats = false;
    }
  }

  /**
   * Load stats for a chunk of stories with caching
   */
  private async loadStatsForChunk(stories: Story[]) {
    const statsPromises = stories.map(async (story) => {
      // Check cache first
      const cacheKey = story.id;
      const cached = this.statsCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        this.updateStoryStats(story.id, cached.votes, cached.comments);
        return;
      }

      try {
        // Load stats in parallel
        const [voteCount, commentCount] = await Promise.all([
          this.voteService.countVotes(story.id),
          this.commentService.countComments(story.id)
        ]);

        // Cache the results
        this.statsCache.set(cacheKey, {
          votes: voteCount,
          comments: commentCount,
          timestamp: Date.now()
        });

        // Update the story in the UI
        this.updateStoryStats(story.id, voteCount, commentCount);
        
      } catch (error) {
        console.error(`Error loading stats for story ${story.id}:`, error);
        // Keep placeholder values on error
      }
    });

    await Promise.all(statsPromises);
  }

  /**
   * Update story stats in the UI
   */
  private updateStoryStats(storyId: string, voteCount: number, commentCount: number) {
    const storyIndex = this.stories.findIndex(s => s.id === storyId);
    if (storyIndex !== -1) {
      this.stories[storyIndex] = {
        ...this.stories[storyIndex],
        stats: {
          ...this.stories[storyIndex].stats,
          voteCount,
          commentCount
        }
      };
    }
  }

  /**
   * Optimized user bookmarks loading
   */
  async loadUserBookmarks() {
    if (!this.currentUser?.uid) return;
    
    try {
      this.userBookmarks = await this.bookmarkService.getUserBookmarks(this.currentUser.uid);
      this.bookmarkedStories.clear();
      
      // Use Map for O(1) lookups instead of Set
      this.userBookmarks.forEach(bookmark => {
        this.bookmarkedStories.add(bookmark.storyId);
      });
    } catch (error) {
      console.error('Error loading user bookmarks:', error);
    }
  }

  /**
   * Load more stories with optimized approach
   */
  async loadMoreStories() {
    if (!this.hasMoreStories || this.isLoadingMore) return;
    await this.loadStoriesOptimized(true);
  }

  // Optimized filtering and sorting
  private debounceSearch() {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.debounceTimeout = window.setTimeout(() => {
      // Trigger change detection for filtered results
      // The actual filtering happens in the getter
    }, 300);
  }

  private sortStories(a: Story, b: Story): number {
    switch (this.sortType) {
      case 'newest':
        return this.getDateValue(b.createdAt) - this.getDateValue(a.createdAt);
      case 'oldest':
        return this.getDateValue(a.createdAt) - this.getDateValue(b.createdAt);
      case 'az':
        return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
      case 'popular':
      case 'trending':
        const aVotes = a.stats.voteCount || 0;
        const bVotes = b.stats.voteCount || 0;
        if (aVotes !== bVotes) return bVotes - aVotes;
        return this.getDateValue(b.createdAt) - this.getDateValue(a.createdAt);
      default:
        return 0;
    }
  }

  private getDateValue(date: Timestamp | Date): number {
    if (date instanceof Date) return date.getTime();
    if (date && typeof date.toDate === 'function') return date.toDate().getTime();
    return 0;
  }

  private updateAvailableCategories() {
    const categories = new Set(this.stories.map(story => story.category).filter(Boolean));
    this.availableCategories = Array.from(categories).sort();
  }

  // Memoized getter for filtered stories
  get filteredStories(): Story[] {
    return this.stories
      .filter(story => {
        if (story.status !== StoryStatus.PUBLISHED) return false;

        if (this.searchQuery) {
          const q = this.searchQuery.toLowerCase();
          const matchesSearch =
            story.title.toLowerCase().includes(q) ||
            story.content.toLowerCase().includes(q) ||
            story.authorName.toLowerCase().includes(q) ||
            (story.tags && story.tags.some(tag => tag.toLowerCase().includes(q)));
          
          if (!matchesSearch) return false;
        }

        if (this.selectedCategory && story.category !== this.selectedCategory) {
          return false;
        }

        if (this.selectedLanguage && story.language !== this.selectedLanguage) {
          return false;
        }

        return true;
      })
      .sort((a, b) => this.sortStories(a, b));
  }

  get paginatedStories(): Story[] {
    return this.filteredStories;
  }

  // Event handlers
  onSearchChange() {
    this.debounceSearch();
  }

  onFilterChange() {
    // Immediate filter change, no need to reload from server
  }

  onSortChange() {
    // Immediate sort change, no need to reload from server
  }

  clearSearch() {
    this.searchQuery = '';
    this.onSearchChange();
  }

  clearAllFilters() {
    this.searchQuery = '';
    this.selectedCategory = '';
    this.selectedLanguage = '';
    this.sortType = 'newest';
  }

  selectCategory(category: string) {
    this.selectedCategory = category;
    this.onFilterChange();
  }

  // Action handlers with optimistic updates
  async toggleBookmark(event: Event, story: Story) {
    event.preventDefault();
    event.stopPropagation();
    
    if (!this.currentUser?.uid) {
      return;
    }

    try {
      const isCurrentlyBookmarked = this.isBookmarked(story.id);
      
      // Optimistic update - show change immediately
      if (isCurrentlyBookmarked) {
        this.bookmarkedStories.delete(story.id);
      } else {
        this.bookmarkedStories.add(story.id);
      }
      
      if (isCurrentlyBookmarked) {
        // Remove bookmark
        const bookmark = this.userBookmarks.find(b => b.storyId === story.id);
        if (bookmark) {
          await this.bookmarkService.toggleBookmark(bookmark);
          this.userBookmarks = this.userBookmarks.filter(b => b.id !== bookmark.id);
        }
      } else {
        // Add bookmark
        const bookmarkData: Bookmark = {
          id: '',
          userId: this.currentUser.uid,
          storyId: story.id,
          title: story.title,
          authorName: story.authorName,
          emoji: story.emoji,
          category: story.category || 'General',
          createdAt: new Date()
        };

        await this.bookmarkService.toggleBookmark(bookmarkData);
        this.userBookmarks.push({
          ...bookmarkData,
          createdAt: new Date()
        } as Bookmark);
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      
      // Revert optimistic update on error
      const isCurrentlyBookmarked = this.isBookmarked(story.id);
      if (isCurrentlyBookmarked) {
        this.bookmarkedStories.delete(story.id);
      } else {
        this.bookmarkedStories.add(story.id);
      }
    }
  }

  shareStory(event: Event, story: Story) {
    event.preventDefault();
    event.stopPropagation();
    
    if (navigator.share) {
      navigator.share({
        title: story.title,
        url: window.location.origin + '/story/' + story.id
      });
    } else {
      const url = window.location.origin + '/story/' + story.id;
      navigator.clipboard.writeText(url).then(() => {
        // Could show a success message here
      });
    }
  }

  scrollSlider(direction: number) {
    const slider = document.querySelector('.quick-filters-slider') as HTMLElement;
    if (slider) {
      const scrollAmount = 200;
      slider.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
  }

  // Helper methods
  trackByStoryId(index: number, story: Story): string {
    return story.id;
  }

  getAuthorInitials(authorName: string): string {
    return authorName
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);
  }

  getCategoryCount(category: string): number {
    return this.stories.filter(story => story.category === category).length;
  }

  formatDate(date: Timestamp | Date): string {
    try {
      const dateObj = date instanceof Date ? date : date.toDate();
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - dateObj.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));

      if (diffHours < 1) return 'just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return dateObj.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric'
      });
    } catch (error) {
      return 'Unknown date';
    }
  }

  getEstimatedReadTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  }

  getContentSnippet(content: string, maxLength = 180): string {
    if (!content) return '';
    const stripped = content.replace(/<[^>]*>/g, '');
    return stripped.length > maxLength 
      ? stripped.substring(0, maxLength) + '...' 
      : stripped;
  }

  getLanguageLabel(language: string): string {
    const labels: Record<string, string> = {
      'en': 'English',
      'ar': 'العربية',
      'fr': 'Français'
    };
    return labels[language] || language.toUpperCase();
  }

  formatCount(count: number): string {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  }

  isBookmarked(storyId: string): boolean {
    return this.bookmarkedStories.has(storyId);
  }

  // Cleanup method for cache management
  private cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.statsCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.statsCache.delete(key);
      }
    }
  }
}