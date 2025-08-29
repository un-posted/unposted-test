import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StoriesService } from '../story/services/story.service';
import { VotesService } from '../story/services/vote.service';
import { CommentsService } from '../story/services/comment.service';
import { Story } from '../models/story';
import { StoryStatus } from '../models/firestore';
import { Timestamp } from '@angular/fire/firestore';
import { AuthService } from '../../auth/auth';
import { ProfileService } from '../profile/profile.service';
import { Bookmark, CreateBookmarkData } from '../models/bookmark';

@Component({
  selector: 'app-stories',
  imports: [FormsModule, RouterModule, CommonModule],
  template: `
<div class="unposted-feed">
  <!-- Header -->
  <header class="feed-header">
    <div class="header-content">
      <div class="brand">
        <span class="moon-icon">🌙</span>
        <!--<h1>Unposted</h1>-->
        <span class="tagline">Where untold stories find their voice</span>
      </div>
      
      <div class="header-actions">
        <div class="search-container">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="M21 21l-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            placeholder="Search stories..."
            [(ngModel)]="searchQuery"
            (input)="onSearchChange()"
            class="search-input"
          />
          <button *ngIf="searchQuery" class="search-clear" (click)="clearSearch()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <!--<div class="filter-container">
          <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <select [(ngModel)]="sortType" (change)="onSortChange()" class="filter-select">
            <option value="newest">Latest</option>
            <option value="popular">Trending</option>
            <option value="az">Alphabetical</option>
          </select>
        </div>-->

        <button class="write-btn" routerLink="/write">Write Story</button>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="feed-container">
    <div class="feed-content">
      
      <!-- Quick Filters -->
      <div class="quick-filters" *ngIf="!isLoading">
        <button 
          class="filter-tag" 
          [class.active]="selectedCategory === ''"
          (click)="selectCategory('')">
          All Stories
        </button>
        <button 
          *ngFor="let category of availableCategories.slice(0, 6)" 
          class="filter-tag"
          [class.active]="selectedCategory === category"
          (click)="selectCategory(category)">
          {{ category }}
          <span class="tag-count">{{ getCategoryCount(category) }}</span>
        </button>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="loading-state">
        <div class="story-skeleton" *ngFor="let i of [1,2,3,4,5]">
          <div class="skeleton-header">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-meta">
              <div class="skeleton-line short"></div>
              <div class="skeleton-line shorter"></div>
            </div>
          </div>
          <div class="skeleton-content">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line subtitle"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line medium"></div>
          </div>
        </div>
      </div>

      <!-- Stories Feed -->
      <div class="stories-feed" *ngIf="!isLoading">
        <article
          *ngFor="let story of paginatedStories; trackBy: trackByStoryId"
          class="story-card"
          
        >
          <!-- Story Header -->
          <div class="story-header">
            <div class="author-info">
              <div class="author-avatar"  [routerLink]="['/profile/', story.authorId]">
                <span>{{ getAuthorInitials(story.authorName) }}</span>
              </div>
              <div class="author-details">
                <h3 class="author-name"  [routerLink]="['/profile/', story.authorId]">{{ story.authorName }}</h3>
                <div class="story-meta">
                  <span>{{ formatDate(story.createdAt) }}</span>
                  <span class="separator">•</span>
                  <span>{{ story.readTime || getEstimatedReadTime(story.content) }} min read</span>
                  <span class="separator" *ngIf="story.language">•</span>
                  <span class="language" *ngIf="story.language">{{ getLanguageLabel(story.language) }}</span>
                </div>
              </div>
            </div>
            
            <button 
              class="bookmark-btn" 
              [class.bookmarked]="isBookmarked(story.id)"
              (click)="toggleBookmark($event, story)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
              </svg>
            </button>
          </div>

          <!-- Story Content -->
          <div class="story-content" [routerLink]="['/story/', story.id]">
            <div class="story-title-section">
              <span class="story-emoji">{{ story.emoji }}</span>
              <h2 class="story-title">{{ story.title }}</h2>
            </div>
            
            <p class="story-subtitle" *ngIf="story.excerpt">{{ story.excerpt }}</p>
            <p class="story-preview" *ngIf="!story.excerpt">
              {{ getContentSnippet(story.content, 180) }}
            </p>

            <!-- Category Badge -->
            <div class="story-category">
              <span class="category-badge" [attr.data-category]="story.category">
                {{ story.category }}
              </span>
            </div>
          </div>

          <!-- Story Actions -->
          <div class="story-actions">
            <div class="engagement-actions">
              <button class="action-btn upvote" [disabled]="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7"></path>
              </svg>
                <span>{{ formatCount(story.voteCount || 0) }}</span>
              </button>
              
              <button class="action-btn comment" [disabled]="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>{{ formatCount(story.commentCount || 0) }}</span>
              </button>
              
              <button class="action-btn share" (click)="shareStory($event, story)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
                <span>Share</span>
              </button>
            </div>

            <button class="read-more" [routerLink]="['/story/', story.id]">Read Story</button>
          </div>
        </article>
      </div>

      <!-- Empty State -->
      <div *ngIf="!isLoading && filteredStories.length === 0" class="empty-state">
        <div class="empty-illustration">
          <span class="moon-icon large">🌙</span>
        </div>
        <h3>No stories found</h3>
        <p>Try adjusting your search or explore different categories</p>
        <button class="explore-btn" (click)="clearAllFilters()">
          Explore All Stories
        </button>
      </div>

      <!-- Load More -->
      <div class="load-more-container" *ngIf="!isLoading && hasMoreStories && filteredStories.length > 0">
        <button class="load-more-btn" (click)="loadMoreStories()" [disabled]="isLoadingMore">
          <span *ngIf="!isLoadingMore">Show More Stories</span>
          <div *ngIf="isLoadingMore" class="loading-dots">
            <span></span><span></span><span></span>
          </div>
        </button>
      </div>
    </div>
  </main>

  <!-- Error Toast -->
  <div class="error-toast" [class.show]="errorMessage" *ngIf="errorMessage">
    <div class="toast-content">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      <span>{{ errorMessage }}</span>
    </div>
    <button (click)="errorMessage = ''" class="toast-close">×</button>
  </div>
</div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');


    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      color: #2e2e2e;
      background-color: #F5E1A5FF;
    }

    .unposted-feed {
      min-height: 100vh;
      background-color: #fefcf7;
      font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    /* Header Styles */
    .feed-header {
      background: rgba(254, 252, 247, 0.95);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid  #f2efe9;
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 1rem 0;
    }

    .header-content {
      max-width: 900px;
      margin: 0 auto;
      padding: 0 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .moon-icon {
      font-size: 1.5rem;
      opacity: 0.8;
    }

    .moon-icon.large {
      font-size: 3rem;
    }

    .brand h1 {
      font-size: 1.75rem;
      font-weight: 700;
      color:  #2e2e2e;
      letter-spacing: -0.5px;
      margin: 0;
    }

    .tagline {
      font-size: 0.75rem;
      color:  #9a948c;
      font-weight: 300;
      margin-left: 0.5rem;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    /* Search Styles */
    .search-container {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 1rem;
      width: 16px;
      height: 16px;
      color:  #9a948c;
      z-index: 1;
    }

    .search-input {
      padding: 0.75rem 1rem 0.75rem 2.75rem;
      border: 1px solid  #e6e1d7;
      border-radius:  18px;
      background:  #ffffff;
      font-family: inherit;
      font-size: 0.875rem;
      width: 280px;
      transition:  all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      color:  #2e2e2e;
    }

    .search-input:focus {
      outline: none;
      border-color:  #f7c843;
      box-shadow: 0 0 0 3px rgba(230, 177, 122, 0.1);
    }

    .search-clear {
      position: absolute;
      right: 0.75rem;
      width: 20px;
      height: 20px;
      border: none;
      background: none;
      cursor: pointer;
      color:  #9a948c;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition:  all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .search-clear:hover {
      background:  #f2efe9;
      color:  #5c554d;
    }

    /* Filter Styles */
    .filter-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .filter-icon {
      width: 16px;
      height: 16px;
      color:  #9a948c;
    }

    .filter-select {
      padding: 0.75rem 1rem;
      border: 1px solid  #e6e1d7;
      border-radius:  18px;
      background:  #ffffff;
      font-family: inherit;
      font-size: 0.875rem;
      cursor: pointer;
      color:  #2e2e2e;
      transition:  all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .filter-select:focus {
      outline: none;
      border-color:  #f7c843;
    }

    .write-btn {
      padding: 0.75rem 1.5rem;
      background:  #2e2e2e;
      color:  #ffffff;
      border: none;
      border-radius:  18px;
      font-weight: 500;
      font-size: 0.875rem;
      cursor: pointer;
      transition:  all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: inherit;
    }

    .write-btn:hover {
      background: #1a1a1a;
      transform: translateY(-1px);
    }


    .write-btn:disabled {
  background: #aaa;     /* gray out */
  color: #666;          /* dim text */
  cursor: not-allowed;  /* "forbidden" cursor */
  transform: none;      /* disable hover lift */
  opacity: 0.6;         /* optional transparency */
}

.write-btn:disabled:hover {
  background: #aaa;     /* prevent hover effect */
  transform: none;
}


.action-btn:disabled {
         /* dim text */
  cursor: not-allowed;  /* "forbidden" cursor */
        /* optional transparency */
}

    /* Main Feed Styles */
    .feed-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2.5rem 2rem;
    }

    .feed-content {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    /* Quick Filters */
    .quick-filters {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      padding-bottom: 1rem;
    }

    .filter-tag {
      padding: 0.5rem 1rem;
      border: 1px solid  #e6e1d7;
      background:  #ffffff;
      color:  #5c554d;
      border-radius:  18px;
      font-size: 0.8rem;
      font-weight: 400;
      cursor: pointer;
      transition:  all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: inherit;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .filter-tag:hover {
      border-color:  #f7c843;
      background: rgba(230, 177, 122, 0.05);
    }

    .filter-tag.active {
      background:  #f7c843;
      border-color:  #f7c843;
      color: white;
    }

    .tag-count {
      font-size: 0.7rem;
      opacity: 0.7;
      background: rgba(255, 255, 255, 0.2);
      padding: 0.1rem 0.4rem;
      border-radius: 10px;
    }

    .filter-tag.active .tag-count {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Loading State */
    .loading-state {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .story-skeleton {
      background:  #ffffff;
      border-radius:  14px;
      padding: 2rem;
      border: 1px solid  #f2efe9;
    }

    .skeleton-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .skeleton-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(90deg,  #f2efe9) 25%,  #e6e1d7 50%,  #f2efe9 75%;
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .skeleton-meta {
      flex: 1;
    }

    .skeleton-line {
      height: 0.875rem;
      background: linear-gradient(90deg,  #f2efe9) 25%,  #e6e1d7 50%,  #f2efe9 75%;
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
      margin-bottom: 0.75rem;
    }

    .skeleton-line.short { width: 40%; }
    .skeleton-line.shorter { width: 25%; }
    .skeleton-line.medium { width: 70%; }
    .skeleton-line.title { height: 1.25rem; width: 85%; margin-bottom: 1rem; }
    .skeleton-line.subtitle { width: 60%; margin-bottom: 1rem; }

    .skeleton-content {
      display: flex;
      flex-direction: column;
    }

    @keyframes shimmer {
      0% { background-position: -200px 0; }
      100% { background-position: calc(200px + 100%) 0; }
    }

    /* Stories Feed */
    .stories-feed {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .story-card {
      background:  #ffffff;
      border-radius:  14px;
      padding: 1rem;
      border: 1px solid  #f2efe9;
      text-decoration: none;
      color: inherit;
      display: block;
      transition:  all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    //.story-card:hover {
      //transform: translateY(-2px);
      //box-shadow:  0 8px 28px rgba(0, 0, 0, 0.08);
      //border-color:  #e6e1d7;
    //}

    /* Story Header */
    .story-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }

    .author-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .author-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #F7C843;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
      letter-spacing: 0.5px;
      cursor: pointer;
    }

    .author-name {
      font-size: 0.95rem;
      font-weight: 500;
      color:  #2e2e2e;
      margin: 0 0 0.25rem 0;
      cursor: pointer;
    }

    .story-meta {
      font-size: 0.8rem;
      color:  #9a948c;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .separator {
      opacity: 0.5;
    }

    .bookmark-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
      border-radius:   6px;
      transition:  all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      color:  #9a948c;
      cursor: pointer;
    }

    .bookmark-btn svg {
      width: 18px;
      height: 18px;
    }

    .bookmark-btn:hover {
      background:  #f2efe9;
      color:  #5c554d;
    }

    .bookmark-btn.bookmarked {
      color:  #f7c843;
    }

    .bookmark-btn.bookmarked svg {
      fill: currentColor;
    }

    /* Story Content */
    .story-content {
      margin-bottom: 1.5rem;
      cursor: pointer;
    }

    .story-title-section {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .story-emoji {
      font-size: 1.25rem;
      line-height: 1;
      margin-top: 0.25rem;
    }

    .story-title {
      font-size: 1.5rem;
      font-weight: 600;
      line-height: 1.3;
      color:  #2e2e2e;
      margin: 0;
      letter-spacing: -0.5px;
      flex: 1;
    }

    .story-subtitle {
      font-size: 1rem;
      color:  #5c554d;
      line-height: 1.5;
      margin-bottom: 1rem;
      font-style: italic;
      font-weight: 300;
    }

    .story-preview {
      font-size: 0.9rem;
      line-height: 1.6;
      color:  #9a948c;
      font-weight: 300;
      margin-bottom: 1rem;
    }

    .story-category {
      display: flex;
      align-items: center;
      margin-top: 0.75rem;
    }

    .category-badge {
      padding: 0.25rem 0.75rem;
      border-radius:  18px;
      font-size: 0.7rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Category Colors */
    .category-badge[data-category="Personal Growth"] { color: #fef3c7; background: #92400e; }
.category-badge[data-category="Life Lessons"] { color: #fce7f3; background: #9d174d; }
.category-badge[data-category="Cultural Heritage"] { color: #e0f2fe; background: #0369a1; }
.category-badge[data-category="Travel & Adventure"] { color: #dbeafe; background: #1e40af; }
.category-badge[data-category="Work & Career"] { color: #f3e8ff; background: #6d28d9; }
.category-badge[data-category="Relationships"] { color: #ffe4e6; background: #be123c; }
.category-badge[data-category="Family Stories"] { color: #dcfce7; background: #166534; }
.category-badge[data-category="Overcoming Challenges"] { color: #fee2e2; background: #b91c1c; }
.category-badge[data-category="Creative Journey"] { color: #ccfbf1; background: #0f766e; }
.category-badge[data-category="Social Impact"] { color: #ede9fe; background: #5b21b6; }
.category-badge[data-category="Health & Wellness"] { color: #fef9c3; background: #854d0e; }
.category-badge[data-category="Education & Learning"] { color: #d1fae5; background: #047857; }
.category-badge[data-category="Dreams & Aspirations"] { color: #fdf2f8; background: #9d174d; }
.category-badge[data-category="Unexpected Moments"] { color: #e0f7fa; background: #00695c; }
.category-badge[data-category="Other"] { color: #f5f5f5; background: #374151; }

    /* Story Actions */
    .story-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 1.5rem;
      border-top: 1px solid  #f2efe9;
    }

    .engagement-actions {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .action-btn {
      cursor: pointer;
      background: none;
      border: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-radius:  18px;
      font-size: 0.875rem;
      font-weight: 400;
      color:  #9a948c;
      transition:  all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: inherit;
    }

    .action-btn svg {
      width: 16px;
      height: 16px;
    }

    .action-btn:hover {
      background:  #f2efe9;
      color:  #5c554d;
    }

    .action-btn.active {
      color:  #f7c843;
    }

    .action-btn.upvote.active svg {
      fill: currentColor;
    }

    .read-more {
      background:  #2e2e2e;
      color:  #ffffff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius:  18px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition:  all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: inherit;
    }

    .read-more:hover {
      background: #1a1a1a;
      transform: translateY(-1px);
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      background:  #ffffff;
      border-radius:  14px;
      border: 1px solid  #f2efe9;
    }

    .empty-illustration {
      margin-bottom: 1.5rem;
    }

    .empty-state h3 {
      font-size: 1.25rem;
      font-weight: 600;
      color:  #2e2e2e;
      margin-bottom: 0.5rem;
    }

    .empty-state p {
      font-size: 0.95rem;
      color:  #5c554d;
      margin-bottom: 2rem;
    }

    .explore-btn {
      padding: 0.75rem 2rem;
      background:  #f7c843;
      color: white;
      border: none;
      border-radius:  18px;
      font-weight: 500;
      font-size: 0.875rem;
      cursor: pointer;
      transition:  all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: inherit;
    }

    .explore-btn:hover {
      background:  #e6b739;
      transform: translateY(-1px);
    }

    /* Load More */
    .load-more-container {
      text-align: center;
      padding-top: 2rem;
    }

    .load-more-btn {
      padding: 1rem 2rem;
      background:  #ffffff;
      border: 1px solid  #e6e1d7;
      border-radius:  18px;
      color:  #5c554d;
      font-weight: 500;
      font-size: 0.875rem;
      cursor: pointer;
      transition:  all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: inherit;
    }

    .load-more-btn:hover:not(:disabled) {
      border-color:  #f7c843;
      color:  #f7c843;
      background: rgba(230, 177, 122, 0.05);
    }

    .load-more-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .loading-dots {
      display: flex;
      gap: 4px;
      align-items: center;
      justify-content: center;
    }

    .loading-dots span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background:  #9a948c;
      animation: bounce 1.4s infinite ease-in-out both;
    }

    .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
    .loading-dots span:nth-child(2) { animation-delay: -0.16s; }

    @keyframes bounce {
      0%, 80%, 100% {
        transform: scale(0);
        opacity: 0.5;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }

    /* Error Toast */
    .error-toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius:  10px;
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      box-shadow:  0 8px 28px rgba(0, 0, 0, 0.08);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      z-index: 1000;
      max-width: 400px;
      font-family: inherit;
    }

    .error-toast.show {
      transform: translateX(0);
    }

    .toast-content {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
    }

    .toast-content svg {
      width: 16px;
      height: 16px;
      color: #dc2626;
      flex-shrink: 0;
    }

    .toast-content span {
      color: #991b1b;
      font-size: 0.875rem;
      font-weight: 400;
    }

    .toast-close {
      background: none;
      border: none;
      color: #991b1b;
      cursor: pointer;
      font-size: 1.25rem;
      line-height: 1;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition:  all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .toast-close:hover {
      background: rgba(153, 27, 27, 0.1);
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .header-content {
        padding: 0 1rem;
        gap: 1rem;
        flex-direction: column;
      }

      .brand {
        justify-content: center;
        text-align: center;
      }

      .brand h1 {
        font-size: 1.5rem;
      }

      .tagline {
        display: block;
        margin-top: 0.25rem;
        margin-left: 0;
      }

      .header-actions {
        width: 100%;
        justify-content: space-between;
        gap: 1rem;
      }

      .search-input {
        width: 300px;
      }

      .feed-container {
        padding: 1.5rem 1rem;
      }

      .story-card {
        padding: 1.5rem;
      }

      .story-title {
        font-size: 1.25rem;
      }

      .story-actions {
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
      }

      .engagement-actions {
        justify-content: space-around;
      }

      .read-more {
        width: 100%;
        justify-content: center;
      }

      .quick-filters {
        justify-content: center;
        gap: 0.5rem;
      }

      .filter-tag {
        font-size: 0.75rem;
        padding: 0.4rem 0.8rem;
      }

    }

    @media (max-width: 480px) {
      .header-content {
        padding: 0 0.75rem;
      }

      .brand h1 {
        font-size: 1.25rem;
      }

      .search-input {
        width: 160px;
        font-size: 0.8rem;
      }

      .filter-select {
        font-size: 0.8rem;
        padding: 0.6rem 0.8rem;
      }

      .write-btn {
        padding: 0.6rem 1rem;
        font-size: 0.8rem;
      }

      .feed-container {
        padding: 1rem 0.75rem;
      }

      .story-card {
        padding: 1.25rem;
      }

      .author-avatar {
        width: 40px;
        height: 40px;
        font-size: 0.8rem;
      }

      .story-title-section {
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-start;
      }

      .story-title {
        font-size: 1.125rem;
      }

      .story-subtitle,
      .story-preview {
        font-size: 0.85rem;
      }

      .action-btn {
        font-size: 0.8rem;
        padding: 0.4rem 0.6rem;
      }

      .read-more {
        font-size: 0.8rem;
        padding: 0.6rem 1.25rem;
      }
    }

    /* Dark mode support (if needed) */
    @media (prefers-color-scheme: dark) {

      .skeleton-avatar,
      .skeleton-line {
        background: linear-gradient(90deg, #3a3833 25%, #4a463f 50%, #3a3833 75%);
      }

      .feed-header {
        background: rgba(26, 25, 23, 0.95);
      }

      .category-badge[data-category="Personal Growth"] { background: #fef3c7; color: #92400e; }
.category-badge[data-category="Life Lessons"] { background: #fce7f3; color: #9d174d; }
.category-badge[data-category="Cultural Heritage"] { background: #e0f2fe; color: #0369a1; }
.category-badge[data-category="Travel & Adventure"] { background: #dbeafe; color: #1e40af; }
.category-badge[data-category="Work & Career"] { background: #f3e8ff; color: #6d28d9; }
.category-badge[data-category="Relationships"] { background: #ffe4e6; color: #be123c; }
.category-badge[data-category="Family Stories"] { background: #dcfce7; color: #166534; }
.category-badge[data-category="Overcoming Challenges"] { background: #fee2e2; color: #b91c1c; }
.category-badge[data-category="Creative Journey"] { background: #ccfbf1; color: #0f766e; }
.category-badge[data-category="Social Impact"] { background: #ede9fe; color: #5b21b6; }
.category-badge[data-category="Health & Wellness"] { background: #fef9c3; color: #854d0e; }
.category-badge[data-category="Education & Learning"] { background: #d1fae5; color: #047857; }
.category-badge[data-category="Dreams & Aspirations"] { background: #fdf2f8; color: #9d174d; }
.category-badge[data-category="Unexpected Moments"] { background: #e0f7fa; color: #00695c; }
.category-badge[data-category="Other"] { background: #f5f5f5; color: #374151; }

    }

    /* Accessibility improvements */
    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    /* Focus styles for keyboard navigation */
    .story-card:focus,
    .filter-tag:focus,
    .action-btn:focus,
    .bookmark-btn:focus,
    .load-more-btn:focus,
    .search-input:focus,
    .filter-select:focus,
    .write-btn:focus {
      outline: 2px solid  #f7c843;
      outline-offset: 2px;
    }

    /* Smooth scrolling */
    html {
      scroll-behavior: smooth;
    }

    /* Selection styles */
    ::selection {
      background: rgba(230, 177, 122, 0.3);
    }


    /* Styles for upvote button */
.upvote-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  border: none;
  background: none;
  cursor: pointer;
  color: #888;
  font-weight: 500;
  transition: color 0.2s;
}

.upvote-btn svg {
  transition: stroke 0.2s;
}

.upvote-btn:hover {
  color: #ff4500; /* highlight on hover */
}

.upvote-btn.voted {
  color: #ff4500; /* highlighted when voted */
}

.upvote-btn.voted svg {
  stroke: #ff4500;
}

  `]
})
export class StoriesComponent implements OnInit {
  private storiesService = inject(StoriesService);
  private votesService = inject(VotesService);
  private commentsService = inject(CommentsService);
  private authService = inject(AuthService);
    private profileService = inject(ProfileService); // Add this injection

  
  // State management
  stories: Story[] = [];
  isLoading = true;
  isLoadingMore = false;
  errorMessage = '';
  hasMoreStories = true;
  currentUser: any = null;


  // Pagination
  storiesPerPage = 10;
  currentPage = 1;

  // Filtering and sorting
  searchQuery = '';
  selectedCategory = '';
  selectedLanguage = '';
  sortType: 'newest' | 'oldest' | 'az' | 'popular' | 'trending' = 'newest';

  // Computed properties
  availableCategories: string[] = [];
  private userBookmarks: Bookmark[] = []; // Store user bookmarks

  // Bookmarked stories (simulated)
  private bookmarkedStories = new Set<string>();

  ngOnInit() {
    this.loadStories();
    this.authService.user$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadUserBookmarks(); // Load bookmarks when user is available
      } else {
        this.bookmarkedStories.clear();
        this.userBookmarks = [];
      }
    });
  }

  async loadStories(append = false) {
    try {
      if (!append) {
        this.isLoading = true;
        this.errorMessage = '';
      } else {
        this.isLoadingMore = true;
      }
  
      // Fetch stories
      const loadedStories = await this.storiesService.getStories(20);
      console.log(loadedStories)
  
      // Add voteCount to each story
      const storiesWithVotes = await Promise.all(
        loadedStories.map(async (story) => {
          try {
            const count = await this.votesService.countVotes(story.id);
            const commentCount = await this.commentsService.countComments(story.id);
            return { ...story, voteCount: count , commentCount: commentCount};
          } catch (error) {
            console.error(`Error loading vote count for story ${story.id}:`, error);
            return { ...story, voteCount: 0, commentCount:0 };
          }
        })
      );
  
      // Append or replace stories
      this.stories = append ? [...this.stories, ...storiesWithVotes] : storiesWithVotes;
  
      // Update UI state
      this.updateAvailableCategories();
      this.hasMoreStories = loadedStories.length === 20;
  
    } catch (error) {
      console.error('Error loading stories:', error);
      this.errorMessage = 'Failed to load stories. Please try again later.';
    } finally {
      this.isLoading = false;
      this.isLoadingMore = false;
    }
  }
  

  async loadMoreStories() {
    if (!this.hasMoreStories || this.isLoadingMore) return;
    await this.loadStories(true);
  }

  private updateAvailableCategories() {
    const categories = new Set(this.stories.map(story => story.category));
    this.availableCategories = Array.from(categories).sort();
  }

  // Event handlers
  onSearchChange() {
    this.currentPage = 1;
    this.debounceSearch();
  }

  onFilterChange() {
    this.currentPage = 1;
  }

  onSortChange() {
    this.currentPage = 1;
  }

  private debounceTimeout?: number;
  private debounceSearch() {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.debounceTimeout = window.setTimeout(() => {
      // Search handling is done in the getter
    }, 300);
  }

  selectCategory(category: string) {
    this.selectedCategory = category;
    this.onFilterChange();
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
    this.currentPage = 1;
  }

  // Filtering and sorting
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
            (story.excerpt && story.excerpt.toLowerCase().includes(q)) ||
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
        const aVotes = a.voteCount || 0;
        const bVotes = b.voteCount || 0;
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

  // Pagination
  get paginatedStories(): Story[] {
    const start = (this.currentPage - 1) * this.storiesPerPage;
    return this.filteredStories.slice(start, start + this.storiesPerPage);
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
    const labels: { [key: string]: string } = {
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

  async loadUserBookmarks() {
    if (!this.currentUser?.uid) return;
    
    try {
      this.userBookmarks = await this.profileService.getUserBookmarks(this.currentUser.uid);
      this.bookmarkedStories.clear();
      console.log(this.userBookmarks);
      // Populate the Set with bookmarked story IDs for quick lookup
      this.userBookmarks.forEach(bookmark => {
        this.bookmarkedStories.add(bookmark.storyId);
      });
    } catch (error) {
      console.error('Error loading user bookmarks:', error);
    }
  }

  isBookmarked(storyId: string): boolean {
    return this.bookmarkedStories.has(storyId);
  }

  // Action handlers
 async toggleBookmark(event: Event, story: Story) {
    event.preventDefault();
    event.stopPropagation();
    
    // Check if user is authenticated
    if (!this.currentUser?.uid) {
      // You can show a login prompt here
      console.log('User must be logged in to bookmark stories');
      return;
    }

    try {
      const isCurrentlyBookmarked = this.isBookmarked(story.id);
      
      if (isCurrentlyBookmarked) {
        // Remove bookmark
        const bookmark = this.userBookmarks.find(b => b.storyId === story.id);
        if (bookmark) {
          await this.profileService.deleteBookmark(bookmark.id);
          this.bookmarkedStories.delete(story.id);
          // Remove from local array
          this.userBookmarks = this.userBookmarks.filter(b => b.id !== bookmark.id);
        }
      } else {
        // Add bookmark - using your actual Bookmark interface
        const bookmarkData: CreateBookmarkData = {
          userId: this.currentUser.uid,
          storyId: story.id,
          storyTitle: story.title,
          storyAuthor: story.authorName,
          storyExcerpt: story.excerpt || this.getContentSnippet(story.content, 100),
          storyUrl: `/story/${story.id}`, // Internal story URL
          tags: story.tags || [], // Use story tags if available
          notes: '', // Empty notes initially
          isPublic: false, // Default to private bookmarks
          category: story.category || 'General' // Use story category as bookmark category
        };

        const newBookmarkId = await this.profileService.createBookmark(bookmarkData);
        this.bookmarkedStories.add(story.id);
        
        // Add to local array with approximate timestamp
        this.userBookmarks.push({
          id: newBookmarkId,
          ...bookmarkData,
          createdAt: new Date() // Approximate timestamp
        } as Bookmark);
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      // Optionally show user feedback about the error
    }
  }

  shareStory(event: Event, story: Story) {
    event.preventDefault();
    event.stopPropagation();
    
    if (navigator.share) {
      navigator.share({
        title: story.title,
        text: story.excerpt || this.getContentSnippet(story.content, 100),
        url: window.location.origin + '/story/' + story.id
      });
    } else {
      const url = window.location.origin + '/story/' + story.id;
      navigator.clipboard.writeText(url).then(() => {
      });
    }
  }
}