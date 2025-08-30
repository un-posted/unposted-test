import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ProfileService } from './profile.service';
import { AuthService } from '../../auth/auth';
import { UserProfile } from '../models/user-profile';
import { Draft } from '../models/draft';
import { Story } from '../models/story';
import { Bookmark } from '../models/bookmark';
import { ActivatedRoute, Router } from '@angular/router';
import { getAuth, user } from '@angular/fire/auth';
import { ViewsService } from '../story/services/views.service';
import { DraftsService } from '../story/services/draft.service';
import { VotesService } from '../story/services/vote.service';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  requirement?: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  type: 'drafts' | 'published' | 'words' | 'streak' | 'community';
  requirement: number;
  unlocked: boolean;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profile-container">
      <!-- Loading State -->
      <div *ngIf="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading your profile...</p>
      </div>

      <!-- Profile Content -->
      <div *ngIf="!loading && userProfile" class="profile-content">
        <!-- Profile Header -->
        <div class="profile-header">
          <div class="avatar-section">
            <div class="avatar-container">
              <img [src]="userProfile.photoURL || defaultAvatar" [alt]="userProfile.displayName" class="avatar">
              <!-- Level Badge -->
              <div class="level-badge">
                <span class="level-number">{{ userProfile.level || 1 }}</span>
              </div>
            </div>
          </div>
          
          <div class="profile-info">
            <div class="name-section">
              <h1 *ngIf="!editingName" class="user-name" (click)="startEditingName()">
                {{ userProfile.displayName || 'Anonymous User' }}
                <span class="edit-icon" *ngIf="isOwnProfile">✏️</span>
              </h1>
              <div *ngIf="editingName" class="name-edit">
                <input 
                  [(ngModel)]="tempName" 
                  class="name-input"
                  (keyup.enter)="saveName()"
                  (keyup.escape)="cancelNameEdit()"
                  #nameInput>
                <div class="edit-actions">
                  <button class="save-btn" (click)="saveName()" [disabled]="savingProfile">
                    {{ savingProfile ? 'Saving...' : 'Save' }}
                  </button>
                  <button class="cancel-btn" (click)="cancelNameEdit()">Cancel</button>
                </div>
              </div>
            </div>

            <!-- Writing Streak -->
            <div class="streak-section" *ngIf="userProfile.writingStreak && userProfile.writingStreak > 0">
              <div class="streak-indicator">
                🔥 {{ userProfile.writingStreak }}-day writing streak
              </div>
              <small class="streak-info" *ngIf="userProfile.lastWriteDate">
                Last activity: {{ formatDate(userProfile.lastWriteDate) }}
              </small>
            </div>

            <!-- XP Progress -->
            <div class="xp-section">
              <div class="xp-info">
                <span class="xp-current">{{ userProfile.totalXP || 0 }} XP</span>
                <span class="xp-next">{{ getNextLevelXP() - (userProfile.totalXP || 0) }} XP to level {{ (userProfile.level || 1) + 1 }}</span>
              </div>
              <div class="xp-bar">
                <div class="xp-progress" [style.width.%]="getXPProgress()"></div>
              </div>
            </div>
            
            <div class="bio-section">
              <p *ngIf="!editingBio" class="user-bio" (click)="startEditingBio()">
                {{ userProfile.bio || 'No bio added yet. Click to add one!' }}
                <span class="edit-icon" *ngIf="isOwnProfile">✏️</span>
              </p>
              <div *ngIf="editingBio" class="bio-edit">
                <textarea 
                  [(ngModel)]="tempBio" 
                  class="bio-textarea"
                  rows="3"
                  (keyup.escape)="cancelBioEdit()"
                  placeholder="Tell us about yourself..."
                  #bioInput></textarea>
                <div class="edit-actions">
                  <button class="save-btn" (click)="saveBio()" [disabled]="savingProfile">
                    {{ savingProfile ? 'Saving...' : 'Save' }}
                  </button>
                  <button class="cancel-btn" (click)="cancelBioEdit()">Cancel</button>
                </div>
              </div>
            </div>
            
            <div class="user-stats">
              <div class="stat" *ngIf="isOwnProfile">
                <span class="stat-number">{{ drafts.length }}</span>
                <span class="stat-label">Drafts</span>
              </div>
              <div class="stat">
                <span class="stat-number">{{ stories.length }}</span>
                <span class="stat-label">Articles</span>
              </div>
              <div class="stat">
                <span class="stat-number">{{ bookmarks.length }}</span>
                <span class="stat-label">Bookmarks</span>
              </div>
              <div class="stat">
                <span class="stat-number">{{ formatNumber(userProfile.stats.followersCount) || 0 }}</span>
                <span class="stat-label">Followers</span>
              </div>
              <div class="stat">
                <span class="stat-number">{{ formatNumber(userProfile.stats.followingCount) || 0 }}</span>
                <span class="stat-label">Following</span>
              </div>
              <div class="stat" *ngIf="userProfile.stats.totalViews">
                <span class="stat-number">{{ formatNumber(userProfile.stats.totalViews) }}</span>
                <span class="stat-label">Total Views</span>
              </div>
            </div>

            <!-- Follow Button (only show if viewing another user's profile) -->
            <div class="follow-section" *ngIf="!isOwnProfile">
              <button 
                class="follow-btn" 
                [class.following]="isFollowing"
                (click)="toggleFollow()"
                [disabled]="followLoading">
                {{ followLoading ? 'Loading...' : (isFollowing ? 'Following' : 'Follow') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Motivation Banner -->
        <div class="motivation-banner" *ngIf="getMotivationMessage()">
          <div class="motivation-content">
            <span class="motivation-icon">✨</span>
            <span class="motivation-text">{{ getMotivationMessage() }}</span>
          </div>
        </div>

        <!-- Badges Section -->
        <div class="badges-section" *ngIf="badges.length > 0">
          <h3 class="section-title">Achievements</h3>
          <div class="badges-grid">
            <div 
              *ngFor="let badge of badges" 
              class="badge-item"
              [class.unlocked]="badge.unlocked"
              [title]="badge.description">
              <div class="badge-icon">{{ badge.icon }}</div>
              <div class="badge-info">
                <div class="badge-name">{{ badge.name }}</div>
                <div class="badge-progress" *ngIf="!badge.unlocked && badge.progress !== undefined">
                  {{ badge.progress }}/{{ badge.requirement }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Update the Community Impact section -->
<div class="community-section" *ngIf="userProfile.stats?.totalViews || userProfile.stats.bookmarksCount">
  <h3 class="section-title">Community Impact</h3>
  <div class="impact-stats">
    <div class="impact-stat" *ngIf="userProfile.stats?.totalViews">
      <span class="impact-number">{{ formatNumber(userProfile.stats.totalViews) }}</span>
      <span class="impact-label">Total reads across your stories</span>
    </div>
    <div class="impact-stat" *ngIf="userProfile.stats.bookmarksCount">
      <span class="impact-number">{{ userProfile.stats.bookmarksCount }}</span>
      <span class="impact-label">Times your stories were bookmarked</span>
    </div>
    <div class="impact-stat" *ngIf="userProfile.stats?.totalVotes">
      <span class="impact-number">{{ formatNumber(userProfile.stats.totalVotes) }}</span>
      <span class="impact-label">Total votes on your stories</span>
    </div>
  </div>
</div>

        <!-- Navigation Tabs -->
        <div class="tabs-container">
          <div class="tabs">
            <button 
              class="tab"
              [class.active]="activeTab === 'drafts'"
              (click)="setActiveTab('drafts')"
              *ngIf="isOwnProfile">
              Drafts ({{ drafts.length }})
            </button>
            <button 
              class="tab"
              [class.active]="activeTab === 'articles'"
              (click)="setActiveTab('articles')">
              Articles ({{ stories.length }})
            </button>
            <button 
              class="tab"
              [class.active]="activeTab === 'bookmarks'"
              (click)="setActiveTab('bookmarks')"
              *ngIf="isOwnProfile">
              Bookmarks ({{ bookmarks.length }})
            </button>
          </div>
        </div>

        <!-- Content Sections -->
        <div class="content-container">
          <!-- Drafts Section -->
          <div *ngIf="activeTab === 'drafts'" class="content-section">
            <div *ngIf="drafts.length === 0" class="empty-state">
              <h3>No drafts yet</h3>
              <p>Start writing your first draft to see it here.</p>
              <div class="empty-rewards">
                <span class="reward-text">+10 XP for your first draft!</span>
              </div>
              <button class="create-btn" (click)="createNewDraft()">Create Draft</button>
            </div>
            <div *ngFor="let draft of drafts" class="content-card">
              <div class="card-header">
                <h2 class="card-title">{{ draft.emoji }}</h2>
                <h3 class="card-title">{{ draft.title }}</h3>
              </div>
              <p class="card-excerpt">{{ draft.excerpt || getExcerpt(draft.content) }}</p>
              <div class="card-footer">
                <span class="card-date">Last modified {{ formatDate(draft.updatedAt) }}</span>
                <div class="card-stats">
                  <span class="stat-item">📝 {{ draft.wordCount || 0 }} words</span>
                  <span class="stat-item">⏱ {{ draft.readTime || 1 }} min read</span>
                </div>
                <div class="card-actions">
                  <button class="action-btn" (click)="editDraft(draft)">Edit</button>
                  <button class="action-btn secondary" (click)="publishDraft(draft)">
                    Publish (+25 XP)
                  </button>
                  <button class="action-btn danger" (click)="deleteDraft(draft)">Delete</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Articles Section -->
          <div *ngIf="activeTab === 'articles'" class="content-section">
            <div *ngIf="stories.length === 0" class="empty-state">
              <h3>No published articles</h3>
              <p>Publish your first draft to see it here.</p>
              <div class="empty-rewards">
                <span class="reward-text">+25 XP for publishing!</span>
              </div>
            </div>
            <div *ngFor="let story of stories" class="content-card">
              <div class="card-header">
                <h2 class="card-title">{{ story.emoji }}</h2>
                <h3 class="card-title">{{ story.title }}</h3>
              </div>
              <p class="card-excerpt">{{ story.excerpt || getExcerpt(story.content) }}</p>
              <div class="bookmark-tags" *ngIf="story.tags && story.tags.length > 0">
                <span *ngFor="let tag of story.tags" class="tag">{{ tag }}</span>
              </div>
              <div class="card-footer">
                <span class="card-date">Published {{ formatDate(story.createdAt) }}</span>
                <div class="card-stats">
                  <span class="stat-item">👁 {{ story.readCount || 0 }} views</span>
                  <span class="stat-item">⭐ {{ story.voteCount || 0 }} votes</span>
                  <span class="stat-item">⏱ {{ story.readTime || 1 }} min read</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Bookmarks Section -->
          <div *ngIf="activeTab === 'bookmarks'" class="content-section">
            <div *ngIf="bookmarks.length === 0" class="empty-state">
              <h3>No bookmarks yet</h3>
              <p>Save interesting articles to read them later.</p>
              <div class="empty-rewards">
                <span class="reward-text">+5 XP for each bookmark!</span>
              </div>
            </div>
            <div *ngFor="let bookmark of bookmarks" class="content-card">
              <div class="card-header">
                <h3 class="card-title">{{ bookmark.storyTitle }}</h3>
                <span class="card-meta">by {{ bookmark.storyAuthor }}</span>
              </div>
              <p *ngIf="bookmark.storyExcerpt" class="card-excerpt">{{ bookmark.storyExcerpt }}</p>
              <p *ngIf="bookmark.notes" class="bookmark-notes">
                <strong>Notes:</strong> {{ bookmark.notes }}
              </p>
              <div class="bookmark-tags" *ngIf="bookmark.tags && bookmark.tags.length > 0">
                <span *ngFor="let tag of bookmark.tags" class="tag">{{ tag }}</span>
              </div>
              <div class="card-footer">
                <span class="card-date">Saved {{ formatDate(bookmark.createdAt) }}</span>
                <div class="card-actions">
                  <button class="action-btn" (click)="readBookmark(bookmark)">Read</button>
                  <button class="action-btn secondary" (click)="editBookmark(bookmark)">Edit</button>
                  <button class="action-btn danger" (click)="removeBookmark(bookmark)">Remove</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div *ngIf="!loading && !userProfile" class="error-state">
        <h3>Profile not found</h3>
        <p>There was an error loading your profile.</p>
        <button class="retry-btn" (click)="loadProfileData()">Retry</button>
      </div>
    </div>
  `,
  styles: [`
    .profile-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      background-color: #FDFCF9;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .loading-state,
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      text-align: center;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #EDEAE3;
      border-top: 4px solid #F7C843;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .profile-header {
      display: flex;
      gap: 2rem;
      margin-bottom: 2rem;
      background: #ffffff;
      padding: 2rem;
      border-radius: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      border: 1px solid #EDEAE3;
    }

    .avatar-section {
      flex-shrink: 0;
      position: relative;
    }

    .avatar-container {
      position: relative;
      cursor: pointer;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      overflow: hidden;
      transition: all 0.2s ease;
    }

    .avatar {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border: 3px solid #EDEAE3;
    }

    .level-badge {
      position: absolute;
      bottom: -5px;
      right: -5px;
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #F7C843, #EDEAE3);
      border: 3px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(247, 200, 67, 0.3);
    }

    .level-number {
      color: #2E2E2E;
      font-weight: 700;
      font-size: 0.875rem;
    }

    .profile-info {
      flex: 1;
      min-width: 0;
    }

    .name-section {
      margin-bottom: 1rem;
    }

    .user-name {
      font-size: 2rem;
      font-weight: 700;
      color: #2E2E2E;
      margin: 0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: color 0.2s ease;
    }

    .user-name:hover {
      color: #F7C843;
    }

    .edit-icon {
      font-size: 1rem;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .user-name:hover .edit-icon,
    .user-bio:hover .edit-icon {
      opacity: 1;
    }

    .streak-section {
      margin-bottom: 1rem;
    }

    .streak-indicator {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, #F7C843, #EDEAE3);
      color: #2E2E2E;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(247, 200, 67, 0.2);
      margin-bottom: 0.5rem;
    }

    .streak-info {
      color: #666;
      font-size: 0.75rem;
    }

    .xp-section {
      margin-bottom: 1rem;
    }

    .xp-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
    }

    .xp-current {
      font-weight: 600;
      color: #2E2E2E;
    }

    .xp-next {
      color: #666666;
    }

    .xp-bar {
      height: 8px;
      background: #EDEAE3;
      border-radius: 4px;
      overflow: hidden;
    }

    .xp-progress {
      height: 100%;
      background: linear-gradient(90deg, #F7C843, #EDEAE3);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .follow-section {
      margin-top: 1rem;
    }

    .follow-btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 2px solid #F7C843;
      background: #F7C843;
      color: #2E2E2E;
    }

    .follow-btn:hover {
      background: #EDEAE3;
    }

    .follow-btn.following {
      background: transparent;
      color: #F7C843;
    }

    .follow-btn.following:hover {
      background: #EDEAE3;
    }

    .follow-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .name-edit,
    .bio-edit {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .name-input {
      font-size: 2rem;
      font-weight: 700;
      color: #2E2E2E;
      border: 2px solid #F7C843;
      border-radius: 8px;
      padding: 0.5rem;
      background: #FDFCF9;
      font-family: inherit;
      outline: none;
    }

    .bio-section {
      margin-bottom: 1.5rem;
    }

    .user-bio {
      font-size: 1.125rem;
      color: #666666;
      line-height: 1.6;
      margin: 0;
      cursor: pointer;
      display: inline-flex;
      align-items: flex-start;
      gap: 0.5rem;
      transition: color 0.2s ease;
    }

    .user-bio:hover {
      color: #2E2E2E;
    }

    .bio-textarea {
      font-size: 1.125rem;
      color: #2E2E2E;
      border: 2px solid #F7C843;
      border-radius: 8px;
      padding: 0.75rem;
      background: #FDFCF9;
      font-family: inherit;
      resize: vertical;
      outline: none;
      line-height: 1.6;
      min-height: 80px;
    }

    .edit-actions {
      display: flex;
      gap: 0.5rem;
    }

    .save-btn,
    .cancel-btn,
    .create-btn,
    .retry-btn {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }

    .save-btn,
    .create-btn,
    .retry-btn {
      background: #F7C843;
      color: #2E2E2E;
    }

    .save-btn:hover,
    .create-btn:hover,
    .retry-btn:hover {
      background: #EDEAE3;
    }

    .save-btn:disabled {
      background: #666666;
      cursor: not-allowed;
    }

    .cancel-btn {
      background: #EDEAE3;
      color: #666666;
    }

    .cancel-btn:hover {
      background: #666666;
      color: #fff;
    }

    .user-stats {
      display: flex;
      gap: 2rem;
      flex-wrap: wrap;
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      min-width: 80px;
    }

    .stat-number {
      font-size: 1.5rem;
      font-weight: 700;
      color: #2E2E2E;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #666666;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .motivation-banner {
      background: linear-gradient(135deg, #F7C843, #EDEAE3);
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      border: 1px solid #F7C843;
    }

    .motivation-content {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: #2E2E2E;
      font-weight: 500;
    }

    .motivation-icon {
      font-size: 1.25rem;
    }

    .badges-section,
    .community-section {
      background: #ffffff;
      border-radius: 16px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      border: 1px solid #EDEAE3;
    }

    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #2E2E2E;
      margin: 0 0 1.5rem 0;
    }

    .badges-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }

    .badge-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      border-radius: 12px;
      background: #EDEAE3;
      transition: all 0.2s ease;
      opacity: 0.5;
    }

    .badge-item.unlocked {
      background: linear-gradient(135deg, #F7C843, #EDEAE3);
      opacity: 1;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(247, 200, 67, 0.2);
    }

    .badge-icon {
      font-size: 1.5rem;
      width: 40px;
      text-align: center;
    }

    .badge-info {
      flex: 1;
      min-width: 0;
    }

    .badge-name {
      font-weight: 600;
      color: #2E2E2E;
      font-size: 0.875rem;
    }

    .badge-progress {
      font-size: 0.75rem;
      color: #666666;
      margin-top: 0.25rem;
    }

    .impact-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 2rem;
    }

    .impact-stat {
      text-align: center;
    }

    .impact-number {
      display: block;
      font-size: 2rem;
      font-weight: 700;
      color: #F7C843;
      margin-bottom: 0.5rem;
    }

    .impact-label {
      color: #666666;
      font-size: 0.875rem;
      line-height: 1.4;
    }

    .tabs-container {
      margin-bottom: 2rem;
    }

    .tabs {
      display: flex;
      background: #ffffff;
      border-radius: 12px;
      padding: 0.25rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      border: 1px solid #EDEAE3;
    }

    .tab {
      flex: 1;
      padding: 0.875rem 1.5rem;
      background: none;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #666666;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .tab:hover {
      color: #2E2E2E;
      background: #EDEAE3;
    }

    .tab.active {
      color: #2E2E2E;
      background: #F7C843;
    }

    .content-container {
      background: #ffffff;
      border-radius: 16px;
      padding: 2rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      border: 1px solid #EDEAE3;
    }

    .content-section {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: #666666;
    }

    .empty-state h3 {
      font-size: 1.25rem;
      margin: 0 0 0.5rem 0;
      color: #2E2E2E;
    }

    .empty-state p {
      margin: 0 0 1rem 0;
      font-size: 1rem;
    }

    .empty-rewards {
      margin-bottom: 1.5rem;
    }

    .reward-text {
      display: inline-block;
      background: linear-gradient(135deg, #F7C843, #EDEAE3);
      color: #2E2E2E;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .content-card {
      padding: 1.5rem;
      border: 1px solid #EDEAE3;
      border-radius: 12px;
      background: #FDFCF9;
      transition: all 0.2s ease;
    }

    .content-card:hover {
      border-color: #F7C843;
      box-shadow: 0 2px 8px rgba(247, 200, 67, 0.1);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }

    .card-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #2E2E2E;
      margin: 0;
      line-height: 1.4;
      flex: 1;
    }

    .card-meta {
      font-size: 0.875rem;
      color: #666666;
      white-space: nowrap;
      margin-left: 1rem;
    }

    .card-excerpt {
      color: #666666;
      line-height: 1.6;
      margin: 0 0 1rem 0;
    }

    .bookmark-notes {
      color: #666666;
      line-height: 1.6;
      margin: 0.5rem 0;
      font-style: italic;
      background: #EDEAE3;
      padding: 0.75rem;
      border-radius: 6px;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.875rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .card-date {
      color: #666666;
    }

    .card-stats {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .stat-item {
      color: #666666;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .card-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .action-btn {
      padding: 0.375rem 0.875rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid #F7C843;
      background: #F7C843;
      color: #2E2E2E;
    }

    .action-btn:hover {
      background: #EDEAE3;
      border-color: #EDEAE3;
    }

    .action-btn.secondary {
      background: transparent;
      color: #F7C843;
    }

    .action-btn.secondary:hover {
      background: #F7C843;
      color: #2E2E2E;
    }

    .action-btn.danger {
      background: transparent;
      color: #dc3545;
      border-color: #dc3545;
    }

    .action-btn.danger:hover {
      background: #dc3545;
      color: white;
    }

    .bookmark-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .tag {
      padding: 0.25rem 0.5rem;
      background: #EDEAE3;
      color: #666666;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    @media (max-width: 768px) {
      .profile-container {
        padding: 1rem;
      }

      .profile-header {
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 1.5rem;
      }

      .user-stats {
        justify-content: center;
        flex-wrap: wrap;
      }

      .tabs {
        flex-direction: column;
      }

      .card-header {
        flex-direction: column;
        gap: 0.5rem;
      }

      .card-meta {
        margin-left: 0;
      }

      .card-footer {
        flex-direction: column;
        align-items: flex-start;
      }

      .card-actions {
        width: 100%;
        justify-content: flex-start;
      }

      .badges-grid {
        grid-template-columns: 1fr;
      }

      .impact-stats {
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }

      .user-stats {
        gap: 1rem;
      }
    }
  `]
})
export class ProfileComponent implements OnInit, OnDestroy {
    
  @ViewChild('nameInput') nameInput!: ElementRef;
  @ViewChild('bioInput') bioInput!: ElementRef;

  currentUser = getAuth().currentUser;

  // Component state
  userProfile: UserProfile | null = null;
  drafts: Draft[] = [];
  stories: Story[] = [];
  bookmarks: Bookmark[] = [];
  
  activeTab: 'drafts' | 'articles' | 'bookmarks' = 'drafts';
  loading = true;
  savingProfile = false;
  
  // Edit state
  editingName = false;
  editingBio = false;
  tempName = '';
  tempBio = '';

  // Gamification state
  badges: Badge[] = [];
  isOwnProfile = true;
  isFollowing = false;
  followLoading = false;

  // Default avatar
  defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iNjAiIGZpbGw9IiNlNmIxN2EiLz4KPHN2ZyB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEuNSI+CjxwYXRoIGQ9Im0zIDkgOS0xIDktMW0tMSAyIDEwIDEwaDEwbC04LTEwbS0xLTEwSDhsLTggMTB2MTBsOC0xMVoiLz4KPC9zdmc+Cjwvc3ZnPgo=';
  
  private destroy$ = new Subject<void>();

  constructor(
    private profileService: ProfileService,
    private route: ActivatedRoute,
    private viewsService: ViewsService,
    private voteService: VotesService,
    private draftsService: DraftsService,
    private router: Router
  ) {}

  ngOnInit() {
    const currentUserId = sessionStorage.getItem('currentUserId') || this.currentUser?.uid || '';

    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(async paramMap => {
        const uid = paramMap.get('id');
        
        // Set isOwnProfile BEFORE calling loadProfileData
        this.isOwnProfile = !uid || uid === currentUserId;
        
        const targetUid = uid || currentUserId;
        if (!targetUid) {
          this.userProfile = null;
          this.loading = false;
          return;
        }

        // Set default tab based on profile type
        if (!this.isOwnProfile && this.activeTab !== 'articles') {
          this.activeTab = 'articles'; // Default to articles for other users
        }

        await this.loadProfileData(targetUid);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadProfileData(uid?: string) {
    this.loading = true;
    try {
      // Fix: Don't fall back to current user when viewing other profiles
      const targetUid =
        uid ||
        sessionStorage.getItem('currentUserId') ||
        this.currentUser?.uid ||
        '';

      if (!targetUid) {
        this.userProfile = null;
        this.loading = false;
        return;
      }

      const profile = await this.profileService.getUserProfile(targetUid);

      if (!profile) {
        this.userProfile = null;
        this.loading = false;
        return;
      }

      // Initialize stats if missing
      if (!profile?.stats) {
        profile.stats = {
          storiesPublished: 0,
          draftsCount: 0,
          bookmarksCount: 0,
          totalViews: 0,
          totalVotes: 0,
          followersCount: 0,
          followingCount: 0,
        };
      }

      this.userProfile = profile;
      this.initializeBadges();

      // Load appropriate data based on profile ownership
      let loadPromises: [
        Promise<Draft[]>,
        Promise<Story[]>,
        Promise<Bookmark[]>
      ];

      if (this.isOwnProfile) {
        // Only load private data (drafts, bookmarks) for own profile
        loadPromises = [
          this.draftsService.getDraftsByAuthor(targetUid, 20),
          this.profileService.getUserPublishedStories(targetUid),
          this.profileService.getUserBookmarks(targetUid),
        ];
      } else {
        // For other users, only load public stories
        loadPromises = [
          Promise.resolve([] as Draft[]),
          this.profileService.getUserPublishedStories(targetUid),
          Promise.resolve([] as Bookmark[]),
        ];
      }

      const [drafts, stories, bookmarks] = await Promise.all(loadPromises);

      this.drafts = drafts;
      this.stories = stories;
      this.bookmarks = bookmarks;

      // Load view counts for stories
      await this.loadStoryViewCounts();
      // Update badge progress with available data
      this.updateBadgeProgress();

      // Check if following (for other users' profiles)
      if (!this.isOwnProfile && this.currentUser) {
        this.isFollowing = await this.profileService.isFollowing(this.currentUser.uid, targetUid);
      }
    } catch (e) {
      console.error('Error loading profile:', e);
      this.userProfile = null;
    } finally {
      this.loading = false;
    }
  }

  async loadStoryViewCounts() {
    for (const story of this.stories) {
      try {
        story.readCount = await this.viewsService.getViewCount(story.id);
        
        story.voteCount = await this.voteService.countVotes(story.id);
      } catch (error) {
        console.error('Error loading view count for story:', story.id, error);
        story.readCount = 0;
      }
    }
  }

  async toggleFollow() {
    if (!this.currentUser || !this.userProfile || this.isOwnProfile) return;

    const me = this.currentUser.uid;
    const them = this.userProfile.uid;

    this.followLoading = true;
    try {
      if (this.isFollowing) {
        await this.profileService.unfollowUser(me, them);
        this.userProfile.stats.followersCount--;
        this.isFollowing = false;
      } else {
        await this.profileService.followUser(me, them);
        this.userProfile.stats.followersCount++;
        this.isFollowing = true;
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      this.followLoading = false;
    }
  }

  // Streak tracking methods
  async updateWritingStreak() {
    if (!this.currentUser || !this.isOwnProfile) return;
    
    try {
      const today = new Date().toDateString();
      const lastWriteDate = this.userProfile?.lastWriteDate 
        ? new Date(this.userProfile.lastWriteDate).toDateString()
        : null;

      // If user wrote today, no need to update
      if (lastWriteDate === today) return;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = yesterday.toDateString();

      let newStreak = 1;
      
      // If last write was yesterday, continue streak
      if (lastWriteDate === yesterdayString) {
        newStreak = (this.userProfile?.writingStreak || 0) + 1;
      }
      
      // Update streak in profile
      if (this.currentUser) {
        await this.profileService.updateUserProfile(this.currentUser.uid, {
          writingStreak: newStreak,
          lastWriteDate: new Date().toISOString()
        });
      }

      // Update local profile
      if (this.userProfile) {
        this.userProfile.writingStreak = newStreak;
        this.userProfile.lastWriteDate = new Date().toISOString();
      }

      // Award XP for maintaining streak
      if (newStreak % 7 === 0) {
        await this.awardXP(50, `Maintained ${newStreak}-day writing streak`);
      }
    } catch (error) {
      console.error('Error updating writing streak:', error);
    }
  }

  // Gamification methods
  initializeBadges() {
    this.badges = [
      {
        id: 'first-draft',
        name: 'First Draft',
        description: 'Created your first draft',
        icon: '📝',
        unlocked: false
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
        id: 'streak-warrior',
        name: 'Streak Warrior',
        description: 'Maintained a 7-day writing streak',
        icon: '🔥',
        unlocked: false,
        progress: 0,
        requirement: 7
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
  }

  updateBadgeProgress() {
    if (!this.userProfile) return;

    const stats = this.userProfile.stats || {};
    const totalWords = this.calculateTotalWords();
    const totalVotes = this.calculateTotalVotes();
    const totalViews = this.calculateTotalViews();

    // Update badge progress
    this.badges.forEach(badge => {
      switch (badge.id) {
        case 'first-draft':
          badge.unlocked = (this.drafts.length || 0) > 0;
          break;
        case 'first-publish':
          badge.unlocked = (this.stories.length || 0) > 0;
          break;
        case 'prolific-writer':
          badge.progress = Math.min(this.stories.length || 0, badge.requirement!);
          badge.unlocked = (this.stories.length|| 0) >= badge.requirement!;
          break;
        case 'word-master':
          badge.progress = Math.min(totalWords, badge.requirement!);
          badge.unlocked = totalWords >= badge.requirement!;
          break;
        case 'streak-warrior':
          badge.progress = Math.min(this.userProfile?.writingStreak || 0, badge.requirement!);
          badge.unlocked = (this.userProfile?.writingStreak || 0) >= badge.requirement!;
          break;
        case 'community-favorite':
          badge.progress = Math.min(totalVotes, badge.requirement!);
          badge.unlocked = totalVotes >= badge.requirement!;
          break;
        case 'bookworm':
          badge.progress = Math.min(stats.bookmarksCount || 0, badge.requirement!);
          badge.unlocked = (stats.bookmarksCount || 0) >= badge.requirement!;
          break;
      }
    });
  }

  calculateTotalWords(): number {
    return [...this.drafts, ...this.stories].reduce((total, item) => {
      const count = item.wordCount 
        ? Number(item.wordCount) 
        : (item.content ? item.content.trim().split(/\s+/).length : 0);

      return total + count;
    }, 0);
  }

  calculateTotalVotes(): number {
    return this.stories.reduce((total, story) => {
      return total + (story.voteCount || 0);
    }, 0);
  }

  calculateTotalViews(): number {
    return this.stories.reduce((total, story) => {
      return total + (story.readCount || 0);
    }, 0);
  }

  getXPProgress(): number {
    if (!this.userProfile) return 0;
    
    const currentXP = this.userProfile.totalXP || 0;
    const currentLevel = this.userProfile.level || 1;
    const currentLevelXP = this.getLevelXP(currentLevel);
    const nextLevelXP = this.getNextLevelXP();
    
    const levelXPRange = nextLevelXP - currentLevelXP;
    const currentLevelProgress = currentXP - currentLevelXP;
    
    return Math.max(0, Math.min(100, (currentLevelProgress / levelXPRange) * 100));
  }

  getLevelXP(level: number): number {
    // XP required to reach this level (cumulative)
    return Math.pow(level - 1, 2) * 100;
  }

  getNextLevelXP(): number {
    const currentLevel = this.userProfile?.level || 1;
    return this.getLevelXP(currentLevel + 1);
  }

  getMotivationMessage(): string {
    if (!this.userProfile || !this.isOwnProfile) return '';

    const stats = this.userProfile.stats || {};
    const unlockedBadges = this.badges.filter(b => b.unlocked).length;
    const totalBadges = this.badges.length;

    // Check for near achievements
    const nearAchievements = this.badges.filter(badge => 
      !badge.unlocked && 
      badge.progress !== undefined && 
      badge.requirement !== undefined &&
      badge.progress >= badge.requirement * 0.8
    );

    if (nearAchievements.length > 0) {
      const badge = nearAchievements[0];
      const remaining = badge.requirement! - badge.progress!;
      return `You're ${remaining} away from earning "${badge.name}"!`;
    }

    // Streak encouragement
    if ((this.userProfile.writingStreak || 0) > 0) {
      return `Keep your ${this.userProfile.writingStreak}-day streak alive! Write something today.`;
    }

    // General encouragement based on activity
    if (this.drafts.length === 0) {
      return "Ready to start your writing journey? Create your first draft!";
    }

    if (this.stories.length === 0 && this.drafts.length > 0) {
      return "You have drafts ready! Publish your first story to earn 25 XP.";
    }

    if (unlockedBadges < totalBadges) {
      return `${totalBadges - unlockedBadges} more achievements to unlock!`;
    }

    return '';
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

  // Follow system methods
  
  // Tab navigation
  setActiveTab(tab: 'drafts' | 'articles' | 'bookmarks') {
    this.activeTab = tab;
  }

  // Profile editing methods
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
            await this.profileService.createOrUpdateProfile(this.currentUser, {
              displayName: this.tempName.trim()
            });
      }
      
      if (this.userProfile) {
        this.userProfile.displayName = this.tempName.trim();
      }
      this.editingName = false;
    } catch (error) {
      console.error('Error updating name:', error);
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
      await this.profileService.createOrUpdateProfile(this.currentUser, {
        bio: this.tempBio.trim()
      });}
      
      if (this.userProfile) {
        this.userProfile.bio = this.tempBio.trim();
      }
      this.editingBio = false;
    } catch (error) {
      console.error('Error updating bio:', error);
    } finally {
      this.savingProfile = false;
    }
  }

  cancelBioEdit() {
    this.editingBio = false;
    this.tempBio = '';
  }

  // Draft methods
  async createNewDraft() {
    try {
      // Navigate to draft creation
      this.router.navigate(['/editor']);
      
      // Award XP for creating a draft
      await this.awardXP(10, 'Created a new draft');
      await this.updateWritingStreak();
    } catch (error) {
      console.error('Error creating new draft:', error);
    }
  }

  editDraft(draft: Draft) {
    // Navigate to draft editor
    this.router.navigate(['/editor', draft.id]);
  }

  async publishDraft(draft: Draft) {
    try {
      await this.profileService.publishDraft(draft.id);
      
      // Award XP for publishing
      await this.awardXP(25, 'Published a story');
      
      // Update writing streak
      await this.updateWritingStreak();
      
      // Reload data to reflect changes
      this.loadProfileData();
    } catch (error) {
      console.error('Error publishing draft:', error);
    }
  }

  async deleteDraft(draft: Draft) {
    if (!confirm('Are you sure you want to delete this draft?')) return;
    
    try {
      await this.draftsService.deleteDraft(draft.id);
      this.drafts = this.drafts.filter(d => d.id !== draft.id);
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  }

  // Bookmark methods
  readBookmark(bookmark: Bookmark) {
    if (bookmark.storyUrl) {
      window.open(bookmark.storyUrl, '_blank');
    } else if (bookmark.storyId) {
      // Navigate to internal story
      this.router.navigate(['/story', bookmark.storyId]);
    }
  }

  editBookmark(bookmark: Bookmark) {
    // Open edit modal or navigate to edit page
    console.log('Edit bookmark:', bookmark.id);
  }

  async removeBookmark(bookmark: Bookmark) {
    if (!confirm('Remove this bookmark?')) return;
    
    try {
      await this.profileService.deleteBookmark(bookmark.id);
      this.bookmarks = this.bookmarks.filter(b => b.id !== bookmark.id);
      
      // Award XP for bookmarking activity
      await this.awardXP(5, 'Removed a bookmark');
    } catch (error) {
      console.error('Error removing bookmark:', error);
    }
  }

  // XP and leveling system
  async awardXP(amount: number, reason: string) {
    if (!this.currentUser || !this.userProfile) return;
    
    try {
      await this.profileService.awardUserXP(this.currentUser.uid, amount, reason);
      
      // Update local profile
      const oldLevel = this.userProfile.level || 1;
      this.userProfile.totalXP = (this.userProfile.totalXP || 0) + amount;
      this.userProfile.level = this.calculateLevel(this.userProfile.totalXP);
      
      // Check for level up
      if (this.userProfile.level > oldLevel) {
        this.showLevelUpNotification(this.userProfile.level);
      }
    } catch (error) {
      console.error('Error awarding XP:', error);
    }
  }

  calculateLevel(totalXP: number): number {
    // Level = sqrt(totalXP / 100) + 1, rounded down
    return Math.floor(Math.sqrt(totalXP / 100)) + 1;
  }

  showLevelUpNotification(newLevel: number) {
    // This could trigger a modal, toast, or other notification
    console.log(`🎉 Level up! You're now level ${newLevel}!`);
    
    // For a real implementation, you might use:
    // this.notificationService.show(`🎉 Level up! You're now level ${newLevel}!`, 'success');
  }

  // Utility methods
  formatDate(date: any): string {
    if (!date) return '';
    
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - dateObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }

  getExcerpt(content: string, maxLength = 150): string {
    if (!content) return '';
    
    const plainText = content.replace(/<[^>]*>/g, ''); // Remove HTML tags
    return plainText.length > maxLength 
      ? plainText.substring(0, maxLength) + '...'
      : plainText;
  }

  calculateReadTime(content: string): number {
    if (!content) return 0;
    
    const words = content.trim().split(/\s+/).length;
    return Math.ceil(words / 200); // Assuming 200 words per minute
  }
}