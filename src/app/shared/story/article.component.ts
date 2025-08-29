import { Component, Input, OnInit, OnDestroy, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoriesService } from '../story/services/story.service';
import { CommentsService } from '../story/services/comment.service';
import { VotesService } from '../story/services/vote.service';
import { ViewsService } from '../story/services/views.service'; // New service for tracking views
import { AuthService } from '../../auth/auth';
import { Story } from '../models/story';
import { Comment } from '../models/comment';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { serverTimestamp, Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-article',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="article-container" *ngIf="story">
    <!-- Loading State -->
    <div *ngIf="isLoading" class="loading-state">
      <div class="modern-spinner"></div>
      <p>Loading story...</p>
    </div>

    <!-- Article Content -->
    <div *ngIf="!isLoading" class="fade-in">
      <!-- Back Navigation
      <button routerLink="/stories" class="back-button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to Stories
      </button>-->

      <!-- Hero Section -->
      <div class="hero-section">
        <div class="article-emoji" [class.pulse]="!isLoading">{{ story.emoji || "📖" }}</div>
        <div class="category-badge" [attr.data-category]="story.category">{{ story.category || "Story" }}</div>
        <h1 class="article-title">{{ story.title }}</h1>

        <!-- Enhanced Meta Information -->
        <div class="article-meta">
          <div class="meta-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>{{ story.authorName || "Anonymous" }}</span>
          </div>
          <div class="meta-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12,6 12,12 16,14"/>
            </svg>
            <span>{{ story.createdAt ? formatDate(story.createdAt) : 'Recently' }}</span>
          </div>
          <div class="meta-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>{{ formatViewCount(viewCount) }} {{ viewCount === 1 ? 'view' : 'views' }}</span>
          </div>
          <div class="meta-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>{{ comments.length }} {{ comments.length === 1 ? 'comment' : 'comments' }}</span>
          </div>
        </div>
      </div>

      <!-- Article Content with Reading Progress -->
      <div class="reading-progress" [style.width.%]="readingProgress"></div>
      <div class="article-content" 
           #articleContent
           [ngClass]="{ 'rtl': isArabic(story.content) }"
           (scroll)="updateReadingProgress()">
        <div [innerHTML]="formatContent(story.content)"></div>
      </div>

      <!-- Enhanced Engagement Section -->
      <div class="engagement-section">
        <!-- Upvote System -->
        <div class="upvote-card">
          <div class="upvote-header">
            <h3>💡 Found this thought-provoking?</h3>
            <p *ngIf="!currentUser">Sign in to show your appreciation!</p>
            <p *ngIf="currentUser">Help others discover great content!</p>
          </div>
          
          <div class="vote-container">
            <div class="vote-display">
              <div class="vote-count">{{ upvoteCount }}</div>
              <div class="vote-label">{{ upvoteCount === 1 ? 'upvote' : 'upvotes' }}</div>
            </div>
            
            <button (click)="toggleUpvote()" 
                    [disabled]="!currentUser || votingInProgress"
                    [class.voted]="hasUpvoted" 
                    [class.disabled]="!currentUser"
                    class="modern-upvote-button">
              <span *ngIf="votingInProgress" class="button-spinner"></span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
              </svg>
              {{ hasUpvoted ? 'Upvoted' : 'Upvote' }}
            </button>
          </div>
        </div>

        <!-- Share Section -->
        <div class="share-section">
          <h4>Share this story</h4>
          <div class="share-buttons">
            
            <button (click)="copyLink()" class="share-btn copy" [class.copied]="linkCopied">
              <svg *ngIf="!linkCopied" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
              </svg>
              <svg *ngIf="linkCopied" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              {{ linkCopied ? 'Copied!' : 'Copy Link' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Enhanced Comments Section -->
      <div class="comments-section">
        <div class="comments-header">
          <h2 class="comments-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Discussion
          </h2>
          <span class="comments-count">{{ comments.length }}</span>
        </div>

        <!-- Comments Filter/Sort -->
        <div class="comments-controls" *ngIf="comments.length > 0">
          <button [class.active]="sortOrder === 'newest'" 
                  (click)="setSortOrder('newest')" 
                  class="sort-btn">
            Newest first
          </button>
          <button [class.active]="sortOrder === 'oldest'" 
                  (click)="setSortOrder('oldest')" 
                  class="sort-btn">
            Oldest first
          </button>
        </div>

        <!-- Loading Comments -->
        <div *ngIf="commentsLoading" class="comments-loading">
          <div class="modern-spinner small"></div>
          <span>Loading comments...</span>
        </div>

        <!-- Empty Comments -->
        <div *ngIf="!commentsLoading && comments.length === 0" class="comments-empty">
          <div class="empty-icon">💭</div>
          <h3>Start the conversation</h3>
          <p>Be the first to share your thoughts on this story!</p>
        </div>

        <!-- Comment Items -->
        <div class="comment-item" 
             *ngFor="let comment of sortedComments; trackBy: trackComment; let i = index"
             [style.animation-delay.ms]="i * 100">
          <div class="comment-header">
            <div class="comment-author">
              <div class="author-avatar" [style.background]="getAvatarColor(comment.username)">
                {{ getInitials(comment.username) }}
              </div>
              <div class="author-info">
                <span class="author-name">{{ comment.username || 'Anonymous' }}</span>
                <div class="comment-date">{{ formatDate(comment.createdAt) }}</div>
              </div>
              <span *ngIf="comment.authorId === story.authorId" class="author-badge">Author</span>
            </div>
            <div class="comment-actions">
              <button *ngIf="canDeleteComment(comment)" 
                      (click)="deleteComment(comment.id!)" 
                      class="delete-btn"
                      title="Delete comment">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="comment-content">{{ comment.content }}</div>
        </div>
      </div>

      <!-- Enhanced Comment Form -->
      <div class="comment-form-card">
        <div *ngIf="!currentUser" class="auth-prompt">
          <div class="auth-icon">🔐</div>
          <h3>Join the Discussion</h3>
          <p>Please <a routerLink="/login" class="auth-link">sign in</a> to share your thoughts and engage with the community.</p>
        </div>

        <div *ngIf="currentUser" class="comment-form">
          <div class="form-header">
            <div class="user-avatar" [style.background]="getAvatarColor(currentUser.displayName)">
              {{ getInitials(currentUser.displayName || currentUser.email) }}
            </div>
            <h3>Share your thoughts</h3>
          </div>
          
          <div class="form-group">
            <textarea 
              [(ngModel)]="commentText" 
              class="modern-textarea" 
              placeholder="What did you think about this story? Share your perspective..."
              maxlength="500" 
              rows="4"
              (input)="adjustTextareaHeight($event)"
              required>
            </textarea>
            <div class="character-count" 
                 [class.warning]="commentText && commentText.length > 450"
                 [class.danger]="commentText && commentText.length >= 500">
              {{ commentText?.length || 0 }} / 500
            </div>
          </div>
          
          <div class="form-actions">
            <button (click)="clearComment()" 
                    *ngIf="commentText?.trim()" 
                    class="secondary-btn">
              Cancel
            </button>
            <button (click)="addComment()" 
                    [disabled]="!commentText?.trim() || commentSubmitting || (commentText?.length || 0) > 500"
                    class="primary-btn">
              <span *ngIf="commentSubmitting" class="button-spinner"></span>
              <svg *ngIf="!commentSubmitting" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22,2 15,22 11,13 2,9 22,2"/>
              </svg>
              {{ commentSubmitting ? 'Posting...' : 'Post Comment' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Success/Error Messages -->
      <div *ngIf="successMessage" class="success-message fade-in">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22,4 12,14.01 9,11.01"/>
        </svg>
        {{ successMessage }}
      </div>

      <div *ngIf="errorMessage" class="error-message fade-in">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        {{ errorMessage }}
      </div>
    </div>
  </div>

  <!-- Story Not Found -->
  <div *ngIf="!story && !isLoading" class="not-found">
    <div class="not-found-icon">📚</div>
    <h2>Story Not Found</h2>
    <p>The story you're looking for doesn't exist or may have been removed.</p>
    <button (click)="goBack()" class="primary-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Back to Stories
    </button>
  </div>
  `,
  styles: [`
    /* Base Styles & Variables */
    :host {
      --primary-color: #f7a600;
      --primary-hover: #e59500;
      --success-color: #10b981;
      --error-color: #ef4444;
      --warning-color: #f59e0b;
      --text-primary: #1f2937;
      --text-secondary: #6b7280;
      --text-muted: #9ca3af;
      --bg-primary: #ffffff;
      --bg-secondary: #f9fafb;
      --bg-elevated: #ffffff;
      --border-color: #e5e7eb;
      --border-hover: #d1d5db;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      --radius-sm: 6px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Layout */
    .article-container { 
      max-width: 800px; 
      margin: 0 auto; 
      padding: 2rem 1rem;
    }

    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideInUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    .fade-in { animation: fadeIn 0.6s ease-out; }
    .slide-in { animation: slideInUp 0.4s ease-out; }
    .pulse { animation: pulse 2s infinite; }

    /* Back Button */
    .back-button {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition);
      margin-bottom: 2rem;
      text-decoration: none;
    }

    .back-button:hover {
      background: var(--bg-elevated);
      color: var(--text-primary);
      border-color: var(--border-hover);
      box-shadow: var(--shadow-sm);
    }

    /* Hero Section */
    .hero-section {
      text-align: center;
      margin-bottom: 3rem;
      padding: 2rem 0;
    }

    .article-emoji { 
      font-size: 4rem; 
      margin-bottom: 1.5rem;
      display: block;
    }

    .article-category { 
      display: inline-block; 
      background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
      color: white; 
      padding: 0.5rem 1.25rem; 
      border-radius: 50px; 
      font-size: 0.875rem; 
      font-weight: 600; 
      margin-bottom: 2rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .article-title { 
      font-size: clamp(2rem, 5vw, 3rem);
      margin-bottom: 2rem; 
      font-weight: 700; 
      line-height: 1.2;
      color: var(--text-primary);
      background: linear-gradient(135deg, var(--text-primary), var(--text-secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .article-meta { 
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1.5rem;
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .meta-item svg {
      opacity: 0.7;
    }

    /* Reading Progress */
    .reading-progress {
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--primary-color), var(--primary-hover));
      z-index: 1000;
      transition: width 0.3s ease;
    }

    /* Article Content */
    .article-content { 
      font-size: 1.125rem; 
      text-align: left; 
      line-height: 1.8; 
      margin: 3rem 0;
      color: var(--text-primary);
    }

    .article-content :deep(p) { 
      margin-bottom: 1.5rem;
    }

    .article-content.rtl { 
      text-align: right; 
      direction: rtl;
    }

    /* Loading States */
    .loading-state, .comments-loading { 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      gap: 1rem; 
      padding: 3rem;
      color: var(--text-secondary);
    }

    .comments-loading { 
      flex-direction: row; 
      justify-content: center; 
      padding: 2rem;
    }
    
    .modern-spinner { 
      width: 40px; 
      height: 40px; 
      border: 3px solid var(--bg-secondary);
      border-top: 3px solid var(--primary-color);
      border-radius: 50%; 
      animation: spin 1s linear infinite;
    }

    .modern-spinner.small { 
      width: 20px; 
      height: 20px; 
      border-width: 2px;
    }

    .button-spinner { 
      display: inline-block; 
      width: 16px; 
      height: 16px; 
      border: 2px solid transparent; 
      border-top: 2px solid currentColor; 
      border-radius: 50%; 
      animation: spin 1s linear infinite; 
      margin-right: 0.5rem;
    }

    /* Engagement Section */
    .engagement-section {
      display: grid;
      gap: 2rem;
      margin: 3rem 0;
    }

    .upvote-card {
      background: var(--bg-elevated);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 2rem;
      text-align: center;
      box-shadow: var(--shadow-sm);
      transition: var(--transition);
    }

    .upvote-card:hover {
      box-shadow: var(--shadow-md);
    }

    .upvote-header h3 {
      margin: 0 0 0.5rem 0;
      color: var(--text-primary);
      font-size: 1.25rem;
    }

    .upvote-header p {
      margin: 0 0 1.5rem 0;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    .vote-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2rem;
    }

    .vote-display {
      text-align: center;
    }

    .vote-count {
      font-size: 2rem;
      font-weight: 800;
      color: var(--primary-color);
      line-height: 1;
    }

    .vote-label {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }

    .modern-upvote-button {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 2rem;
      background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
      color: white;
      border: none;
      border-radius: var(--radius-md);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);
      position: relative;
      overflow: hidden;
    }

    .modern-upvote-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
    }

    .modern-upvote-button.voted {
      background: linear-gradient(135deg, var(--success-color), #059669);
    }

    .modern-upvote-button.disabled {
      background: var(--text-muted);
      cursor: not-allowed;
      transform: none;
    }

    .modern-upvote-button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }

    /* Share Section */
    .share-section {
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      text-align: center;
    }

    .share-section h4 {
      margin: 0 0 1rem 0;
      color: var(--text-primary);
      font-size: 1rem;
    }

    .share-buttons {
      display: flex;
      gap: 1rem;
      justify-content: center;
    }

    .share-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      background: var(--bg-primary);
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition);
    }

    .share-btn:hover {
      background: var(--bg-elevated);
      border-color: var(--border-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    .share-btn.twitter:hover {
      color: #1da1f2;
      border-color: #1da1f2;
    }

    .share-btn.copy.copied {
      color: var(--success-color);
      border-color: var(--success-color);
      background: #f0fdf4;
    }

    /* Comments Section */
    .comments-section { 
      margin: 4rem 0;
    }

    .comments-header { 
      display: flex; 
      align-items: center; 
      justify-content: space-between;
      margin-bottom: 2rem; 
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--border-color);
    }

    .comments-title { 
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.5rem; 
      font-weight: 700; 
      margin: 0;
      color: var(--text-primary);
    }

    .comments-count { 
      background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
      color: white; 
      padding: 0.375rem 0.75rem; 
      border-radius: 50px; 
      font-size: 0.875rem; 
      font-weight: 600;
    }

    .comments-controls {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .sort-btn {
      padding: 0.5rem 1rem;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      background: var(--bg-primary);
      color: var(--text-secondary);
      font-size: 0.875rem;
      cursor: pointer;
      transition: var(--transition);
    }

    .sort-btn.active,
    .sort-btn:hover {
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }

    .comments-empty { 
      text-align: center; 
      padding: 4rem 2rem;
      color: var(--text-secondary);
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .comments-empty h3 {
      margin: 0 0 0.5rem 0;
      color: var(--text-primary);
    }
    
    .comment-item { 
      background: var(--bg-elevated);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      margin-bottom: 1rem;
      transition: var(--transition);
      animation: slideInUp 0.4s ease-out forwards;
    }
    
    .comment-item:hover { 
      box-shadow: var(--shadow-md);
      border-color: var(--border-hover);
    }
    
    .comment-header { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start; 
      margin-bottom: 1rem;
    }
    
    .comment-author { 
      display: flex; 
      align-items: center; 
      gap: 1rem;
    }
    
    .author-avatar { 
      width: 40px; 
      height: 40px; 
      background: var(--primary-color);
      border-radius: 50%; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      font-weight: 600; 
      color: white; 
      flex-shrink: 0;
      font-size: 0.875rem;
    }
    
    .author-info { 
      display: flex; 
      flex-direction: column;
    }
    
    .author-name { 
      font-weight: 600; 
      color: var(--text-primary);
      font-size: 0.9rem;
    }
    
    .comment-date { 
      font-size: 0.75rem; 
      color: var(--text-muted); 
      margin-top: 0.25rem;
    }

    .author-badge {
      background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      margin-left: 0.5rem;
    }
    
    .comment-content { 
      text-align: left; 
      line-height: 1.6; 
      color: var(--text-primary);
      font-size: 0.95rem;
    }

    .comment-actions {
      display: flex;
      gap: 0.5rem;
    }

    .delete-btn { 
      background: none; 
      border: none; 
      cursor: pointer; 
      padding: 0.5rem; 
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      transition: var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .delete-btn:hover { 
      color: var(--error-color);
      background: #fef2f2;
    }

    /* Comment Form */
    .comment-form-card {
      background: var(--bg-elevated);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 2rem;
      margin-top: 2rem;
      box-shadow: var(--shadow-sm);
    }

    .auth-prompt { 
      text-align: center; 
      padding: 2rem;
      color: var(--text-secondary);
    }

    .auth-icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    .auth-prompt h3 {
      margin: 0 0 0.5rem 0;
      color: var(--text-primary);
      font-size: 1.25rem;
    }

    .auth-link { 
      color: var(--primary-color); 
      text-decoration: none; 
      font-weight: 600;
      transition: var(--transition);
    }
    
    .auth-link:hover { 
      text-decoration: underline;
      color: var(--primary-hover);
    }

    .comment-form {
      animation: fadeIn 0.5s ease-out;
    }

    .form-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .form-header h3 {
      margin: 0;
      color: var(--text-primary);
      font-size: 1.125rem;
      font-weight: 600;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      background: var(--primary-color);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      color: white;
      font-size: 0.875rem;
    }
    
    .form-group { 
      margin-bottom: 1.5rem;
    }
    
    .modern-textarea { 
      width: 100%; 
      padding: 1rem; 
      border-radius: var(--radius-md);
      border: 2px solid var(--border-color);
      font-family: inherit; 
      font-size: 1rem; 
      transition: var(--transition);
      resize: vertical;
      min-height: 120px;
      line-height: 1.5;
    }
    
    .modern-textarea:focus { 
      outline: none; 
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(247, 164, 0, 0.1);
    }
    
    .character-count { 
      font-size: 0.75rem; 
      color: var(--text-muted);
      text-align: right; 
      margin-top: 0.5rem; 
      transition: var(--transition);
    }
    
    .character-count.warning { 
      color: var(--warning-color);
      font-weight: 500;
    }

    .character-count.danger { 
      color: var(--error-color);
      font-weight: 600;
    }
    
    .form-actions { 
      display: flex; 
      justify-content: flex-end;
      gap: 1rem;
    }

    /* Buttons */
    .primary-btn { 
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1.75rem;
      border: none;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
      color: white;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: var(--transition);
      position: relative;
      overflow: hidden;
    }
    
    .primary-btn:hover:not(:disabled) { 
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
    }
    
    .primary-btn:disabled { 
      background: var(--text-muted);
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .secondary-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1.75rem;
      border: 2px solid var(--border-color);
      border-radius: var(--radius-md);
      background: var(--bg-primary);
      color: var(--text-secondary);
      font-weight: 500;
      font-size: 0.95rem;
      cursor: pointer;
      transition: var(--transition);
    }

    .secondary-btn:hover {
      border-color: var(--border-hover);
      background: var(--bg-secondary);
      color: var(--text-primary);
    }

    /* Messages */
    .success-message, .error-message { 
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-radius: var(--radius-md);
      margin: 1.5rem 0;
      font-weight: 500;
      font-size: 0.95rem;
    }

    .success-message {
      background: #f0fdf4;
      color: var(--success-color);
      border: 1px solid #bbf7d0;
    }

    .error-message {
      background: #fef2f2;
      color: var(--error-color);
      border: 1px solid #fecaca;
    }

    /* Not Found */
    .not-found { 
      text-align: center; 
      padding: 4rem 2rem;
      color: var(--text-secondary);
    }

    .not-found-icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
    }
    
    .not-found h2 { 
      color: var(--text-primary);
      margin-bottom: 1rem;
      font-size: 1.75rem;
    }

    .not-found p {
      margin-bottom: 2rem;
      font-size: 1.1rem;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .article-container { 
        padding: 1rem;
      }
      
      .article-title { 
        font-size: 2rem;
      }

      .article-meta {
        flex-direction: column;
        gap: 0.75rem;
      }
      
      .vote-container { 
        flex-direction: column; 
        gap: 1.5rem;
      }

      .share-buttons {
        flex-direction: column;
      }
      
      .comment-header { 
        flex-direction: column; 
        align-items: flex-start; 
        gap: 1rem;
      }

      .comment-actions {
        align-self: flex-end;
      }

      .form-actions {
        flex-direction: column-reverse;
      }

      .comments-controls {
        flex-direction: column;
        gap: 0.5rem;
      }
    }

    @media (max-width: 480px) {
      .hero-section {
        padding: 1rem 0;
      }

      .article-emoji {
        font-size: 3rem;
      }

      .modern-upvote-button {
        padding: 0.75rem 1.5rem;
        font-size: 0.9rem;
      }

      .comment-form-card {
        padding: 1.5rem;
      }
    }

    /* Category Badges */
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

/* Base badge look */
.category-badge {
  display: inline-block;
  padding: 0.35rem 0.75rem;
  border-radius: 50px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

  `]
})
export class ArticleComponent implements OnInit, OnDestroy {
  private storiesService = inject(StoriesService);
  private commentsService = inject(CommentsService);
  private votesService = inject(VotesService);
  private viewsService = inject(ViewsService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @Input() storyId!: string;
  @ViewChild('articleContent', { static: false }) articleContent!: ElementRef;

  // State
  story: Story | null = null;
  comments: Comment[] = [];
  currentUser: any = null;
  
  // Loading states
  isLoading = true;
  commentsLoading = true;
  commentSubmitting = false;
  votingInProgress = false;

  // Vote state
  upvoteCount = 0;
  hasUpvoted = false;

  // View tracking
  viewCount = 0;
  viewTracked = false;

  // Form state
  commentText = '';
  errorMessage = '';
  successMessage = '';

  // UI state
  readingProgress = 0;
  sortOrder: 'newest' | 'oldest' = 'newest';
  linkCopied = false;

  // Subscriptions
  private userSubscription?: Subscription;

  ngOnInit() {
    // Get story ID from route parameters
    this.route.params.subscribe(params => {
      const storyId = params['id'];
      if (storyId) {
        this.storyId = storyId;
        this.loadStory(storyId);
      } else {
        this.errorMessage = 'No story ID provided';
        this.isLoading = false;
      }
    });

    // Subscribe to auth state
    this.userSubscription = this.authService.user$.subscribe(user => {
      this.currentUser = user;
      if (user && this.story) {
        this.loadUserVoteStatus();
      }
    });

    // Track scroll for reading progress
    window.addEventListener('scroll', this.updateReadingProgress.bind(this));
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    window.removeEventListener('scroll', this.updateReadingProgress.bind(this));
  }

  async loadStory(storyId?: string) {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      
      const id = storyId || this.route.snapshot.params['id'];
      if (!id) {
        throw new Error('No story ID provided');
      }

      this.story = await this.storiesService.getStoryById(id);
      
      if (!this.story) {
        this.errorMessage = 'Story not found. It may have been deleted or moved.';
        return;
      }

      // Load related data
      await Promise.all([
        this.loadComments(),
        this.loadVoteCount(),
        this.loadViewCount(),
        this.currentUser ? this.loadUserVoteStatus() : Promise.resolve()
      ]);

      // Track view (after a delay to ensure it's a meaningful view)
      setTimeout(() => this.trackView(), 3000);
      
    } catch (error) {
      console.error('Error loading story:', error);
      this.errorMessage = 'Failed to load story. Please check your connection and try again.';
    } finally {
      this.isLoading = false;
    }
  }

  async loadComments() {
    try {
      this.commentsLoading = true;
      this.comments = await this.commentsService.getComments(this.storyId);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      this.commentsLoading = false;
    }
  }

  async loadVoteCount() {
    try {
      this.upvoteCount = await this.votesService.countVotes(this.storyId);
    } catch (error) {
      console.error('Error loading vote count:', error);
    }
  }

  async loadViewCount() {
    try {
      this.viewCount = await this.viewsService.getViewCount(this.storyId);
    } catch (error) {
      console.error('Error loading view count:', error);
    }
  }

  async trackView() {
    if (this.viewTracked || !this.story) return;

    try {
      // Track unique view (by IP/user)
      await this.viewsService.trackView(this.storyId, this.currentUser?.uid);
      this.viewTracked = true;
      // Refresh view count
      await this.loadViewCount();
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  }

  async loadUserVoteStatus() {
    if (!this.currentUser) return;
    
    try {
      this.hasUpvoted = await this.votesService.hasVoted(this.storyId, this.currentUser.uid);
    } catch (error) {
      console.error('Error loading vote status:', error);
    }
  }

  async toggleUpvote() {
    if (!this.currentUser || this.votingInProgress) return;

    this.votingInProgress = true;
    const previousState = this.hasUpvoted;
    const previousCount = this.upvoteCount;

    try {
      // Optimistic update
      this.hasUpvoted = !this.hasUpvoted;
      this.upvoteCount += this.hasUpvoted ? 1 : -1;

      await this.votesService.toggleVote(this.storyId, this.currentUser.uid);
      
      // Show success message
      this.successMessage = this.hasUpvoted ? 'Thanks for your upvote!' : 'Upvote removed';
      setTimeout(() => this.successMessage = '', 3000);
      
      // Refresh actual count from server
      await this.loadVoteCount();
    } catch (error) {
      console.error('Error toggling vote:', error);
      // Revert optimistic update
      this.hasUpvoted = previousState;
      this.upvoteCount = previousCount;
      this.errorMessage = 'Failed to update vote. Please try again.';
      setTimeout(() => this.errorMessage = '', 5000);
    } finally {
      this.votingInProgress = false;
    }
  }

  async addComment() {
    if (!this.currentUser || !this.commentText.trim() || this.commentSubmitting) return;

    this.commentSubmitting = true;
    this.errorMessage = '';

    try {
      const commentData = {
        userId: this.currentUser.uid,
        username: this.currentUser.email?.split('@')[0] || `User${Math.floor(Math.random() * 1000)}`,
        content: this.commentText.trim(),
        createdAt:  serverTimestamp() // optional to include here or via addDoc
      };
      

      await this.commentsService.addComment(this.storyId, commentData);
      
      // Clear form and reload comments
      this.commentText = '';
      this.successMessage = 'Comment posted successfully!';
      setTimeout(() => this.successMessage = '', 3000);
      
      await this.loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      this.errorMessage = 'Failed to post comment. Please try again.';
      setTimeout(() => this.errorMessage = '', 5000);
    } finally {
      this.commentSubmitting = false;
    }
  }

  async deleteComment(commentId: string) {
    if (!this.currentUser) return;

    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) return;

    try {
      await this.commentsService.deleteOwnComment(this.storyId, commentId);
      this.successMessage = 'Comment deleted successfully';
      setTimeout(() => this.successMessage = '', 3000);
      await this.loadComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      this.errorMessage = 'Failed to delete comment. Please try again.';
      setTimeout(() => this.errorMessage = '', 5000);
    }
  }

  clearComment() {
    this.commentText = '';
  }

  canDeleteComment(comment: Comment): boolean {
    if (this.currentUser){
      return comment.userId === this.currentUser.uid;
    } else return false;
      
  }

  trackComment(index: number, comment: Comment): string {
    return comment.id || index.toString();
  }

  getInitials(name: string): string {
    if (!name) return '👤';
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().substring(0, 2);
  }

  getAvatarColor(name: string): string {
    if (!name) return '#f7a600';
    const colors = [
      '#f7a600', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6',
      '#f39c12', '#1abc9c', '#34495e', '#e67e22', '#95a5a6'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  }

  setSortOrder(order: 'newest' | 'oldest') {
    this.sortOrder = order;
  }

  get sortedComments(): Comment[] {
    return [...this.comments].sort((a, b) => {
      const getTime = (value?: Timestamp | Date | null) => {
        if (!value) return 0;
        if (value instanceof Date) return value.getTime();
        if ('toDate' in value && typeof value.toDate === 'function') return value.toDate().getTime();
        return 0;
      };
  
      const timeA = getTime(a.createdAt);
      const timeB = getTime(b.createdAt);
  
      return this.sortOrder === 'newest' 
        ? timeB - timeA
        : timeA - timeB;
    });
  }

  updateReadingProgress() {
    const article = this.articleContent?.nativeElement;
    if (!article) return;

    const scrolled = window.scrollY;
    const articleTop = article.offsetTop;
    const articleHeight = article.offsetHeight;
    const windowHeight = window.innerHeight;

    const progress = Math.max(0, Math.min(100, 
      ((scrolled - articleTop + windowHeight) / articleHeight) * 100
    ));

    this.readingProgress = progress;
  }

  adjustTextareaHeight(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }

  goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/stories']);
    }
  }

 

  async copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.linkCopied = true;
      setTimeout(() => this.linkCopied = false, 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.linkCopied = true;
      setTimeout(() => this.linkCopied = false, 2000);
    }
  }

  isArabic(text: string): boolean {
    if (!text) return false;
    return /[\u0600-\u06FF]/.test(text);
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return 'Recently';
    
    try {
      // Handle Firebase Timestamp
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
      
      return new Intl.DateTimeFormat('en', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      }).format(date);
    } catch {
      return 'Recently';
    }
  }

  formatViewCount(count: number): string {
    if (count < 1000) return count.toString();
    if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
    return (count / 1000000).toFixed(1) + 'M';
  }

  formatContent(content: string): string {
    if (!content) return '';
    
    // Enhanced formatting with better paragraph handling
    return content
      .split(/\n\s*\n/)
      .map(paragraph => {
        const trimmed = paragraph.trim();
        if (!trimmed) return '';
        
        // Convert single line breaks to <br> within paragraphs
        const formatted = trimmed.replace(/\n/g, '<br>');
        return `<p>${formatted}</p>`;
      })
      .filter(p => p)
      .join('');
  }
}