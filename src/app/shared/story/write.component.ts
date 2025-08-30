import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StoriesService } from '../story/services/story.service';
import { AuthService } from '../../auth/auth';
import { CreateStoryData } from '../models/story';
import { StoryStatus } from '../models/firestore';
import { Subscription } from 'rxjs';
import { CreateDraftData } from '../models/draft';
import { DraftsService } from './services/draft.service';

@Component({
  selector: 'app-write-story',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Authentication Check -->
    <div *ngIf="!currentUser && !authLoading" class="auth-required">
      <div class="auth-container">
        <div class="auth-icon">✍️</div>
        <h1>Start writing</h1>
        <p>Join thousands of writers sharing their stories</p>
        <div class="auth-buttons">
          <a routerLink="/login" class="btn-primary">Sign In</a>
          <a routerLink="/register" class="btn-outline">Create Account</a>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div *ngIf="authLoading" class="loading-state">
      <div class="loading-spinner"></div>
    </div>

    <!-- Write Story Form -->
    <div *ngIf="currentUser && !authLoading" class="write-container">
      
      <!-- Top Bar -->
      <div class="top-bar">
        <div class="top-bar-left">
          <button class="logo-btn" (click)="navigateHome()">
            <span class="logo-icon">✍️</span>
            <span class="logo-text">Write</span>
          </button>
          <div class="draft-status" *ngIf="isDraftSaved">
            <span class="status-dot"></span>
            Saved
          </div>
        </div>
        
        <div class="top-bar-right">
          <button 
            class="btn-ghost" 
            (click)="saveDraft()" 
            [disabled]="!canSave() || isSubmitting"
            [class.saving]="isSubmitting && formData.status === 'draft'"
          >
            {{ isSubmitting && formData.status === 'draft' ? 'Saving...' : 'Save draft' }}
          </button>
          
          <button 
            class="btn-publish" 
            (click)="openPublishModal()"
            [disabled]="!canSave() || isSubmitting"
          >
            Publish
          </button>
          
          <div class="user-avatar">
            <img [src]="getUserAvatar()" [alt]="getUserName()" />
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="main-content">
        <div class="story-content">
          
          <!-- Cover Image Section -->
          <div class="cover-section" *ngIf="showCoverOptions || formData.featuredImage">
            <div class="cover-container" *ngIf="formData.featuredImage; else coverUpload">
              <img [src]="formData.featuredImage" alt="Cover" class="cover-image" />
              <div class="cover-overlay">
                <button class="btn-cover-action" (click)="removeCover()">Remove</button>
                <button class="btn-cover-action" (click)="changeCover()">Change</button>
              </div>
            </div>
            <ng-template #coverUpload>
              <div class="cover-upload-area" (click)="fileInput.click()">
                <div class="upload-content">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21,15 16,10 5,21"/>
                  </svg>
                  <span>Add a cover image</span>
                </div>
              </div>
            </ng-template>
            <input #fileInput type="file" accept="image/*" style="display: none" (change)="onCoverImageSelected($event)" />
          </div>

          <!-- Add Cover Button -->
          <button 
            *ngIf="!showCoverOptions && !formData.featuredImage" 
            class="add-cover-btn"
            (click)="showCoverOptions = true"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21,15 16,10 5,21"/>
            </svg>
            Add cover
          </button>

          <!-- Title -->
          <div class="title-container">
            <textarea 
              #titleTextarea
              class="title-input" 
              [(ngModel)]="formData.title"
              placeholder="Title"
              rows="1"
              (input)="adjustTextareaHeight(titleTextarea)"
              maxlength="200"
              required
            ></textarea>
          </div>

          <!-- Subtitle -->
          <div class="subtitle-container">
            <textarea 
              #subtitleTextarea
              class="subtitle-input" 
              [(ngModel)]="formData.excerpt"
              placeholder="Write a subtitle..."
              rows="1"
              (input)="adjustTextareaHeight(subtitleTextarea)"
              maxlength="150"
            ></textarea>
          </div>

          <!-- Floating Toolbar -->
          <div class="editor-toolbar" [class.visible]="showToolbar">
            <div class="toolbar-group">
              <button type="button" (click)="formatText('bold')" [class.active]="isFormatActive('bold')">
                <strong>B</strong>
              </button>
              <button type="button" (click)="formatText('italic')" [class.active]="isFormatActive('italic')">
                <em>I</em>
              </button>
            </div>
            
            <div class="toolbar-divider"></div>
            
            <div class="toolbar-group">
              <button type="button" (click)="insertLink()" title="Link">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              </button>
              <button type="button" (click)="formatText('formatBlock', 'h2')" title="Heading">
                <strong>H</strong>
              </button>
            </div>
            
            <div class="toolbar-divider"></div>
            
            <div class="toolbar-group">
              <button type="button" (click)="formatText('insertUnorderedList')" title="Bullet List">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </button>
              <button type="button" (click)="formatText('insertOrderedList')" title="Numbered List">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="10" y1="6" x2="21" y2="6"/>
                  <line x1="10" y1="12" x2="21" y2="12"/>
                  <line x1="10" y1="18" x2="21" y2="18"/>
                  <path d="4 6h1v4"/>
                  <path d="4 10h2l-2 2h2"/>
                  <path d="6 14v2h-2"/>
                  <path d="4 16h2"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Content Editor -->
          <div 
            class="content-editor"
            [class.rtl]="isRTL"
            contenteditable="true"
            (input)="onContentInput($event)"
            (focus)="onEditorFocus()"
            (blur)="onEditorBlur()"
            (keydown)="onEditorKeydown($event)"
            (keyup)="onEditorKeyup($event)"
            (paste)="onEditorPaste($event)"
            [attr.dir]="isRTL ? 'rtl' : 'ltr'"
            #contentEditor
          >
          <!-- Editor Placeholder -->
          <div class="editor-placeholder" *ngIf="!formData.content || formData.content.length === 0">
            Tell your story...
          </div>
          </div>

          

          <!-- Writing Stats -->
          <div class="writing-stats" *ngIf="formData.content && formData.content.length > 0">
            <span>{{ getWordCount() }} words</span>
            <span class="stat-divider">•</span>
            <span>{{ getReadTime() }} min read</span>
          </div>

        </div>
      </div>

      <!-- Publish Modal -->
      <div class="modal-overlay" *ngIf="showPublishModal" (click)="closePublishModal()">
        <div class="publish-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Story preview</h2>
            <button class="modal-close" (click)="closePublishModal()">×</button>
          </div>
          
          <div class="modal-content">
            <!-- Preview -->
            <div class="story-preview">
              <div class="preview-cover" *ngIf="formData.featuredImage">
                <img [src]="formData.featuredImage" alt="Cover" />
              </div>
              <h1 class="preview-title">{{ formData.title || 'Untitled Story' }}</h1>
              <p class="preview-subtitle" *ngIf="formData.excerpt">{{ formData.excerpt }}</p>
              <div class="preview-meta">
                <div class="author-info">
                  <img [src]="getUserAvatar()" [alt]="getUserName()" class="author-avatar" />
                  <span class="author-name">{{ getUserName() }}</span>
                </div>
                <div class="story-stats">
                  {{ getWordCount() }} words • {{ getReadTime() }} min read
                </div>
              </div>
            </div>

            <!-- Publishing Options -->
            <div class="publish-options">
              
              <!-- Category -->
              <div class="form-group">
                <label>Category</label>
                <select [(ngModel)]="formData.category" name="category" required class="select-input">
                  <option value="" disabled>Choose a category</option>
                  <option *ngFor="let c of categories" [value]="c">{{ c }}</option>
                </select>
              </div>

              <!-- Language & Emoji -->
              <div class="form-row">
                <div class="form-group">
                  <label>Language</label>
                  <select [(ngModel)]="formData.language" name="language" required class="select-input">
                    <option value="" disabled>Select language</option>
                    <option *ngFor="let l of languages" [value]="l.value">{{ l.label }}</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label>Emoji</label>
                  <div class="emoji-container">
                    <input
                      type="text"
                      [(ngModel)]="formData.emoji"
                      name="emoji"
                      placeholder="📝"
                      maxlength="2"
                      required
                      class="emoji-input"
                      (focus)="showEmojiSuggestions = true"
                      (blur)="hideEmojiSuggestions()"
                    />
                    <div class="emoji-suggestions" *ngIf="showEmojiSuggestions">
                      <button 
                        *ngFor="let emoji of emojiSuggestions" 
                        type="button"
                        class="emoji-option"
                        (click)="selectEmoji(emoji)"
                      >
                        {{ emoji }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tags -->
              <div class="form-group">
                <label>Tags (optional)</label>
                <div class="tags-section">
                  <div class="selected-tags" *ngIf="selectedTags.length > 0">
                    <span *ngFor="let tag of selectedTags" class="tag-chip">
                      {{ tag }}
                      <button type="button" (click)="removeTag(tag)" class="tag-remove">×</button>
                    </span>
                  </div>
                  <input
                    type="text"
                    [(ngModel)]="tagsInput"
                    name="tags"
                    placeholder="Add up to 5 tags..."
                    class="tags-input"
                    (keydown.enter)="addTag($event)"
                  />
                </div>
              </div>

            </div>
          </div>
          
          <div class="modal-actions">
            <button class="btn-outline" (click)="closePublishModal()">Cancel</button>
            <button 
              class="btn-publish" 
              (click)="submitStory()"
              [disabled]="!isValidForPublish() || isSubmitting"
            >
              {{ isSubmitting ? 'Publishing...' : 'Publish now' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div class="toast error-toast" *ngIf="errorMessage" [class.visible]="!!errorMessage">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        {{ errorMessage }}
      </div>

      <!-- Success Message -->
      <div class="toast success-toast" *ngIf="successMessage" [class.visible]="!!successMessage">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
        {{ successMessage }}
      </div>

    </div>
  `,
  styles: [`
    :host {
      --primary: #1a8917;
      --primary-hover: #156b13;
      --text-primary: #242424;
      --text-secondary: #6b6b6b;
      --text-muted: #8b8b8b;
      --border-light: #e6e6e6;
      --border-medium: #d1d1d1;
      --background: #ffffff;
      --background-secondary: #f9f9f9;
      --shadow-light: 0 1px 3px rgba(0,0,0,0.05);
      --shadow-medium: 0 4px 12px rgba(0,0,0,0.1);
      --shadow-heavy: 0 8px 24px rgba(0,0,0,0.15);
      --radius: 6px;
      --font-serif: Charter, Georgia, serif;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    /* Auth Required */
    .auth-required {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #F7C843 0%, #f7a600 100%);
      font-family: var(--font-sans);
    }

    .auth-container {
      text-align: center;
      background: white;
      padding: 3rem 2rem;
      border-radius: 12px;
      box-shadow: var(--shadow-heavy);
      max-width: 400px;
    }

    .auth-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .auth-container h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: var(--text-primary);
    }

    .auth-container p {
      color: var(--text-secondary);
      margin-bottom: 2rem;
      font-size: 1.1rem;
    }

    .auth-buttons {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* Loading State */
    .loading-state {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--background);
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-light);
      border-top: 3px solid var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Main Container */
    .write-container {
      min-height: 100vh;
      background: var(--background);
      font-family: var(--font-sans);
    }

    /* Top Bar */
    .top-bar {
      position: sticky;
      top: 0;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border-light);
      padding: 0.75rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 100;
    }

    .top-bar-left {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .logo-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border: none;
      background: none;
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--text-primary);
      cursor: pointer;
      padding: 0.5rem 0;
    }

    .logo-icon {
      font-size: 1.5rem;
    }

    .draft-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      color: var(--text-secondary);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--primary);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .top-bar-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      overflow: hidden;
    }

    .user-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Main Content */
    .main-content {
      max-width: 740px;
      margin: 0 auto;
      padding: 2rem;
    }

    .story-content {
      position: relative;
    }

    /* Cover Section */
    .cover-section {
      margin-bottom: 2rem;
    }

    .cover-container {
      position: relative;
      border-radius: var(--radius);
      overflow: hidden;
      background: var(--background-secondary);
    }

    .cover-image {
      width: 100%;
      height: 300px;
      object-fit: cover;
      display: block;
    }

    .cover-overlay {
      position: absolute;
      top: 1rem;
      right: 1rem;
      display: flex;
      gap: 0.5rem;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .cover-container:hover .cover-overlay {
      opacity: 1;
    }

    .btn-cover-action {
      padding: 0.5rem 1rem;
      background: rgba(0,0,0,0.7);
      color: white;
      border: none;
      border-radius: var(--radius);
      font-size: 0.9rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-cover-action:hover {
      background: rgba(0,0,0,0.9);
    }

    .cover-upload-area {
      height: 200px;
      border: 2px dashed var(--border-medium);
      border-radius: var(--radius);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      background: var(--background-secondary);
    }

    .cover-upload-area:hover {
      border-color: var(--primary);
      background: rgba(26, 137, 23, 0.05);
    }

    .upload-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-secondary);
    }

    .upload-content svg {
      width: 32px;
      height: 32px;
    }

    .add-cover-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border: 1px solid var(--border-medium);
      background: var(--background);
      border-radius: var(--radius);
      color: var(--text-secondary);
      font-size: 0.9rem;
      cursor: pointer;
      margin-bottom: 2rem;
      transition: all 0.2s;
    }

    .add-cover-btn:hover {
      border-color: var(--primary);
      color: var(--primary);
    }

    /* Title */
    .title-container {
      margin-bottom: 1rem;
    }

    .title-input {
      width: 100%;
      font-family: var(--font-serif);
      font-size: 2.5rem;
      font-weight: 700;
      line-height: 1.2;
      color: var(--text-primary);
      border: none;
      outline: none;
      background: transparent;
      resize: none;
      overflow: hidden;
    }

    .title-input::placeholder {
      color: var(--text-muted);
    }

    /* Subtitle */
    .subtitle-container {
      margin-bottom: 2rem;
    }

    .subtitle-input {
      width: 100%;
      font-family: var(--font-serif);
      font-size: 1.4rem;
      font-weight: 400;
      line-height: 1.4;
      color: var(--text-secondary);
      border: none;
      outline: none;
      background: transparent;
      resize: none;
      overflow: hidden;
    }

    .subtitle-input::placeholder {
      color: var(--text-muted);
    }

    /* Editor Toolbar */
    .editor-toolbar {
  position: fixed;
  display: flex;
  align-items: center;
  background: var(--text-primary);
  border-radius: 6px;
  padding: 0.5rem;
  box-shadow: var(--shadow-heavy);
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
  z-index: 1000;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  /* Add these for better mobile compatibility */
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

    .editor-toolbar.visible {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    .toolbar-group {
      display: flex;
    }

    .toolbar-divider {
      width: 1px;
      height: 24px;
      background: rgba(255,255,255,0.2);
      margin: 0 0.5rem;
    }

    .editor-toolbar button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      background: none;
      color: white;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
      position: relative;
    }

    .editor-toolbar button:hover,
    .editor-toolbar button.active {
      background: rgba(255,255,255,0.2);
    }

    /* Content Editor */
    .content-editor {
      font-family: var(--font-serif);
      font-size: 1.25rem;
      line-height: 1.6;
      color: var(--text-primary);
      min-height: 300px;
      padding: 1rem 0;
      outline: none;
      position: relative;
    }

    .content-editor:empty::before {
      content: '';
      position: absolute;
      top: 1rem;
      left: 0;
      right: 0;
      pointer-events: none;
    }

    .editor-placeholder {
  position: absolute;
  top: 1rem;
  left: 0;
  right: 0;
  font-family: var(--font-serif);
  font-size: 1.25rem;
  color: var(--text-muted);
  pointer-events: none;
  font-style: italic;
  z-index: 1; /* Add this line */
}

    .content-editor h1, .content-editor h2 {
      font-weight: 700;
      margin: 2rem 0 1rem 0;
      line-height: 1.2;
    }

    .content-editor h1 {
      font-size: 2rem;
    }

    .content-editor h2 {
      font-size: 1.6rem;
    }

    .content-editor p {
      margin-bottom: 1rem;
    }

    .content-editor ul, .content-editor ol {
      margin-bottom: 1rem;
      padding-left: 2rem;
    }

    .content-editor li {
      margin-bottom: 0.5rem;
    }

    .content-editor.rtl {
      direction: rtl;
      text-align: right;
    }

    /* Writing Stats */
    .writing-stats {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid var(--border-light);
      font-size: 0.9rem;
      color: var(--text-secondary);
    }

    .stat-divider {
      color: var(--text-muted);
    }

    /* Buttons */
    .btn-primary {
      background: #f7a600;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius);
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      text-decoration: none;
      display: inline-block;
      text-align: center;
    }

    .btn-primary:hover:not(:disabled) {
      background: #f7c843;
    }

    .btn-outline {
      background: transparent;
      color: #f7c843;
      border: 1px solid #f7c843;
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-block;
      text-align: center;
    }

    .btn-outline:hover:not(:disabled) {
      background: #f7a600;
      color: white;
    }

    .btn-ghost {
      background: none;
      color: var(--text-secondary);
      border: none;
      padding: 0.75rem 1rem;
      border-radius: var(--radius);
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
    }

    .btn-ghost:hover:not(:disabled) {
      background: var(--background-secondary);
      color: var(--text-primary);
    }

    .btn-ghost.saving {
      color: var(--primary);
    }

    .btn-publish {
      background: #F7C843;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 24px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-publish:hover:not(:disabled) {
      background: #f7a600;
    }

    .btn-primary:disabled,
    .btn-outline:disabled,
    .btn-ghost:disabled,
    .btn-publish:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      padding: 2rem;
    }

    .publish-modal {
      background: white;
      border-radius: 12px;
      box-shadow: var(--shadow-heavy);
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      animation: modalSlideUp 0.3s ease-out;
    }

    @keyframes modalSlideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem 2rem;
      border-bottom: 1px solid var(--border-light);
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
    }

    .modal-close {
      border: none;
      background: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--text-secondary);
      padding: 0;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .modal-close:hover {
      background: var(--background-secondary);
    }

    .modal-content {
      padding: 2rem;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      padding: 1.5rem 2rem;
      border-top: 1px solid var(--border-light);
    }

    /* Story Preview */
    .story-preview {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: var(--background-secondary);
      border-radius: var(--radius);
    }

    .preview-cover {
      margin-bottom: 1rem;
      border-radius: var(--radius);
      overflow: hidden;
    }

    .preview-cover img {
      width: 100%;
      height: 200px;
      object-fit: cover;
    }

    .preview-title {
      font-size: 1.8rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: var(--text-primary);
    }

    .preview-subtitle {
      font-size: 1.1rem;
      color: var(--text-secondary);
      margin-bottom: 1rem;
    }

    .preview-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
      color: var(--text-secondary);
    }

    .author-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .author-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      object-fit: cover;
    }

    /* Publishing Options */
    .publish-options {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-group label {
      font-weight: 600;
      color: var(--text-primary);
      font-size: 0.9rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .select-input {
      padding: 0.75rem;
      border: 1px solid var(--border-medium);
      border-radius: var(--radius);
      background: white;
      font-size: 1rem;
      outline: none;
      transition: border-color 0.2s;
      appearance: none;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      background-size: 16px;
      padding-right: 2.5rem;
    }

    .select-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(26, 137, 23, 0.1);
    }

    .emoji-container {
      position: relative;
    }

    .emoji-input {
      padding: 0.75rem;
      border: 1px solid var(--border-medium);
      border-radius: var(--radius);
      background: white;
      font-size: 1.5rem;
      text-align: center;
      outline: none;
      transition: border-color 0.2s;
      width: 100%;
    }

    .emoji-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(26, 137, 23, 0.1);
    }

    .emoji-suggestions {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid var(--border-medium);
      border-radius: var(--radius);
      box-shadow: var(--shadow-medium);
      max-height: 200px;
      overflow-y: auto;
      z-index: 10;
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 0.25rem;
      padding: 0.5rem;
      margin-top: 0.25rem;
    }

    .emoji-option {
      border: none;
      background: none;
      font-size: 1.2rem;
      padding: 0.5rem;
      cursor: pointer;
      border-radius: 4px;
      transition: background 0.2s;
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .emoji-option:hover {
      background: var(--background-secondary);
    }

    /* Tags */
    .tags-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .selected-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .tag-chip {
      display: inline-flex;
      align-items: center;
      background: var(--background-secondary);
      color: var(--text-primary);
      padding: 0.375rem 0.75rem;
      border-radius: 16px;
      font-size: 0.85rem;
      gap: 0.375rem;
      border: 1px solid var(--border-light);
    }

    .tag-remove {
      border: none;
      background: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 1rem;
      padding: 0;
      line-height: 1;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .tag-remove:hover {
      background: var(--border-medium);
      color: var(--text-primary);
    }

    .tags-input {
      padding: 0.75rem;
      border: 1px solid var(--border-medium);
      border-radius: var(--radius);
      background: white;
      font-size: 1rem;
      outline: none;
      transition: border-color 0.2s;
    }

    .tags-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(26, 137, 23, 0.1);
    }

    /* Toast Messages */
    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-radius: var(--radius);
      font-weight: 500;
      box-shadow: var(--shadow-medium);
      transform: translateX(400px);
      transition: transform 0.3s ease-out;
      z-index: 3000;
      max-width: 400px;
    }

    .toast.visible {
      transform: translateX(0);
    }

    .error-toast {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
    }

    .success-toast {
      background: #f0fdf4;
      color: #16a34a;
      border: 1px solid #bbf7d0;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .top-bar {
        padding: 0.75rem 1rem;
      }

      .main-content {
        padding: 1rem;
      }

      .title-input {
        font-size: 2rem;
      }

      .subtitle-input {
        font-size: 1.2rem;
      }

      .content-editor {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  line-height: 1.6;
  color: var(--text-primary);
  min-height: 300px;
  padding: 1rem 0;
  outline: none;
  position: relative; /* Add this line */
}

      .modal-overlay {
        padding: 1rem;
      }

      .modal-content,
      .modal-header,
      .modal-actions {
        padding-left: 1rem;
        padding-right: 1rem;
      }

      .form-row {
        grid-template-columns: 1fr;
      }

      .cover-image {
        height: 200px;
      }

      .toast {
        bottom: 1rem;
        right: 1rem;
        left: 1rem;
        max-width: none;
      }
    }

    @media (max-width: 480px) {
      .top-bar-left .logo-text {
        display: none;
      }

      .title-input {
        font-size: 1.75rem;
      }

      .editor-toolbar {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    top: auto;
    margin: 0;
    width: 90%;
    justify-content: center;
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    background: var(--background-secondary);
    box-shadow: var(--shadow-medium);
    border: 1px solid var(--border-light);
  }

  .editor-toolbar button {
    color: var(--text-primary);
    width: 44px; /* Larger touch targets for mobile */
    height: 44px;
  }

  .editor-toolbar button:hover,
  .editor-toolbar button.active {
    background: var(--border-light);
  }

  .toolbar-divider {
    background: var(--border-medium);
    height: 32px;
    margin: 0 0.25rem;
  }
  
  /* Ensure content editor has enough space above toolbar */
  .content-editor {
    margin-bottom: 4rem;
  }
}

/* Add these styles for better mobile editor experience */
.content-editor {
  /* Existing styles */
  -webkit-user-select: auto;
  -webkit-touch-callout: default;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
}

/* Improve touch targets for mobile */
@media (max-width: 768px) {
  .btn-ghost, .btn-publish {
    padding: 0.875rem 1.25rem;
    min-height: 44px; /* Minimum touch target size */
  }
  
  .toolbar-group button {
    min-width: 44px;
    min-height: 44px;
  }

      .editor-toolbar button:hover,
      .editor-toolbar button.active {
        background: var(--border-light);
      }

      
    }
  `]
})
export class WriteStoryComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('contentEditor') contentEditor!: ElementRef;
  
  private storiesService = inject(StoriesService);
  private draftsService = inject(DraftsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  

  // Component properties
  currentUser: any = null;
  authLoading = true;
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';
  tagsInput = '';
  selectedTags: string[] = [];
  showPublishModal = false;
  showCoverOptions = false;
  showToolbar = false;
  showEmojiSuggestions = false;
  isDraftSaved = false;
  isRTL = false;

  // Editor properties
  private selectionRange: Range | null = null;
  private toolbarTimeout?: number;
  private isInitialized = false;

  // Emoji suggestions
  emojiSuggestions = [
    '📝', '✍️', '📖', '💭', '🌟', '❤️', '🔥', '💡',
    '🎯', '🚀', '🌈', '✨', '💪', '🙏', '😊', '🎉',
    '🌍', '🏔️', '🌊', '🎨', '🎵', '📚', '⭐', '💫'
  ];

  // Categories and languages
  categories = [
    "Personal Growth", 
    "Life Lessons", 
    "Cultural Heritage", 
    "Travel & Adventure", 
    "Work & Career", 
    "Relationships", 
    "Family Stories",
    "Overcoming Challenges",
    "Creative Journey",
    "Social Impact",
    "Health & Wellness",
    "Education & Learning",
    "Dreams & Aspirations",
    "Unexpected Moments",
    "Other"
  ];

  languages = [
    { value: 'en', label: 'English' },
    { value: 'ar', label: 'العربية' },
    { value: 'fr', label: 'Français' },
    { value: 'mixed', label: 'Mixed Languages' }
  ];

  // Form data
  formData: Partial<CreateStoryData> = {
    category: '',
    language: '',
    emoji: '',
    title: '',
    content: '',
    excerpt: '',
    featuredImage: '',
    status: 'published' as StoryStatus,
    isPublic: true,
    tags: []
  };

  private userSubscription?: Subscription;
  private autoSaveInterval?: number;

  ngOnInit() {
    this.userSubscription = this.authService.user$.subscribe(user => {
      this.currentUser = user;
      this.authLoading = false;
      
      if (user) {
        this.formData.authorId = user.uid;
        this.formData.authorName = user.displayName || user.email?.split('@')[0] || 'Anonymous';
      }
    });

    this.loadDraft();
    this.setupAutoSave();
    this.setupKeyboardShortcuts();
  }

  ngAfterViewInit() {
    this.initializeEditor();
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    if (this.toolbarTimeout) {
      clearTimeout(this.toolbarTimeout);
    }
    
    // Clean up selection change listener
    document.removeEventListener('selectionchange', this.handleSelectionChange.bind(this));
    this.clearMessages();
  }

  // Editor initialization
  private initializeEditor() {
    if (this.isInitialized || !this.contentEditor?.nativeElement) return;
    
    const editor = this.contentEditor.nativeElement;
    
    // Set initial content if exists
    if (this.formData.content) {
      editor.innerHTML = this.formData.content;
    } else {
      // Set up proper paragraph structure for new content
      editor.innerHTML = '<p><br></p>';
    }
    
    // Configure contenteditable behavior
    editor.setAttribute('spellcheck', 'true');
    editor.setAttribute('autocomplete', 'off');
    editor.setAttribute('autocorrect', 'on');
    editor.setAttribute('autocapitalize', 'sentences');
    
    // Set default paragraph style
    document.execCommand('defaultParagraphSeparator', false, 'p');
    
    this.isInitialized = true;
  }

  // Navigation
  navigateHome() {
    this.router.navigate(['/']);
  }

  // User methods
  getUserName(): string {
    if (!this.currentUser) return '';
    return this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'Writer';
  }

  getUserAvatar(): string {
    if (!this.currentUser) return '/assets/default-avatar.png';
    return this.currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.getUserName())}&background=f7c843&color=fff`;
  }

  // Content analysis
  getWordCount(): number {
    if (!this.formData.content) return 0;
    const textContent = this.formData.content.replace(/<[^>]*>/g, '');
    return textContent.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  getReadTime(): number {
    const wordsPerMinute = 200;
    const words = this.getWordCount();
    return Math.max(1, Math.ceil(words / wordsPerMinute));
  }

  // Form validation
  canSave(): boolean {
    return !!(this.formData.title && this.formData.content && this.formData.content.length >= 10);
  }

  isValidForPublish(): boolean {
    return !!(
      this.formData.title &&
      this.formData.content &&
      this.formData.category &&
      this.formData.language &&
      this.formData.emoji
    );
  }

  // Cover image handling
  onCoverImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // In a real app, you'd upload to a service like Firebase Storage
      // For now, we'll use FileReader for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.formData.featuredImage = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeCover() {
    this.formData.featuredImage = '';
    this.showCoverOptions = false;
  }

  changeCover() {
    // Trigger file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fileInput?.click();
  }

  // Editor functionality
  adjustTextareaHeight(textarea: HTMLTextAreaElement) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  onContentInput(event: any) {
    const element = event.target;
    const content = element.innerHTML;
    
    // Auto-detect RTL text
    const textContent = element.textContent || '';
    const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F]/;
    const hasRTL = rtlRegex.test(textContent);
    
    if (hasRTL !== this.isRTL) {
      this.isRTL = hasRTL;
    }
    
    // Update content without triggering innerHTML binding
    if (this.formData.content !== content) {
      this.formData.content = content;
    }
  }

  onEditorKeydown(event: KeyboardEvent) {
    // Handle Enter key for better paragraph formatting
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      
      // Use modern approach to insert paragraph break
      document.execCommand('formatBlock', false, 'p');
      
      // Insert a new paragraph
      document.execCommand('insertParagraph', false);
      
      // Clean up any empty paragraphs or divs
      setTimeout(() => {
        this.cleanupEditorContent();
      }, 0);
    }
    
    // Handle Tab key to insert spaces instead of losing focus
    if (event.key === 'Tab') {
      event.preventDefault();
      document.execCommand('insertText', false, '    ');
    }
  }

  onEditorKeyup(event: KeyboardEvent) {
    this.updateContentFromEditor();
    
    // Handle special keys
    if (event.key === 'Escape') {
      this.showToolbar = false;
    }
  }

  onEditorFocus() {
    // Setup selection tracking
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));
  }

  onEditorBlur() {
    // Clean up selection tracking
    document.removeEventListener('selectionchange', this.handleSelectionChange.bind(this));
    this.hideToolbarDelayed();
  }

  // Replace the handleSelectionChange method with this corrected version
private handleSelectionChange() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    this.hideToolbarDelayed();
    return;
  }

  const range = selection.getRangeAt(0);
  const editorElement = this.contentEditor?.nativeElement;
  
  // Check if selection is within our editor
  if (!editorElement || !editorElement.contains(range.commonAncestorContainer)) {
    this.hideToolbarDelayed();
    return;
  }

  if (range.toString().trim().length > 0) {
    this.selectionRange = range.cloneRange();
    this.showToolbarAtSelection();
  } else {
    this.hideToolbarDelayed();
  }
}

// Add this method to properly handle toolbar positioning
private showToolbarAtSelection() {
  if (this.toolbarTimeout) {
    clearTimeout(this.toolbarTimeout);
  }
  
  this.showToolbar = true;
  
  // Use setTimeout to ensure the DOM is updated before positioning
  setTimeout(() => {
    this.updateToolbarPosition();
  }, 0);
}

// Update the formatText method to ensure proper execution
formatText(command: string, value?: string) {
  // Restore selection before formatting
  if (this.selectionRange) {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(this.selectionRange);
    }
  }
  
  // Apply formatting
  document.execCommand(command, false, value);
  
  // Update content and maintain focus
  this.updateContentFromEditor();
  this.contentEditor?.nativeElement.focus();
  
  // Hide toolbar after formatting
  this.hideToolbarDelayed();
}

  private hideToolbarDelayed() {
    if (this.toolbarTimeout) {
      clearTimeout(this.toolbarTimeout);
    }
    
    this.toolbarTimeout = window.setTimeout(() => {
      this.showToolbar = false;
      this.selectionRange = null;
    }, 150);
  }

  private updateToolbarPosition() {
    if (!this.selectionRange) return;
    
    // Get the bounding rect of the selection
    const rect = this.selectionRange.getBoundingClientRect();
    const toolbar = document.querySelector('.editor-toolbar') as HTMLElement;
    
    if (toolbar) {
      const toolbarRect = toolbar.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Calculate position above the selection
      let top = rect.top - toolbarRect.height - 10;
      let left = rect.left + (rect.width / 2) - (toolbarRect.width / 2);
      
      // Adjust if toolbar would go off screen
      if (left < 10) left = 10;
      if (left + toolbarRect.width > viewportWidth - 10) {
        left = viewportWidth - toolbarRect.width - 10;
      }
      if (top < 10) {
        top = rect.bottom + 10; // Show below if no room above
      }
      
      toolbar.style.position = 'fixed';
      toolbar.style.top = `${top}px`;
      toolbar.style.left = `${left}px`;
      toolbar.style.transform = 'none';
    }
  }

  

  insertLink() {
    const url = prompt('Enter URL:');
    if (url && url.trim()) {
      this.formatText('createLink', url);
    }
  }

  isFormatActive(command: string): boolean {
    try {
      return document.queryCommandState(command);
    } catch (error) {
      // Fallback for commands that might not be supported
      return false;
    }
  }

  private updateContentFromEditor() {
    if (this.contentEditor?.nativeElement) {
      const content = this.contentEditor.nativeElement.innerHTML;
      this.formData.content = content;
    }
  }

  onEditorPaste(event: ClipboardEvent) {
    event.preventDefault();
    
    const paste = event.clipboardData?.getData('text/plain') || '';
    if (paste) {
      // Insert as plain text to avoid style conflicts
      document.execCommand('insertText', false, paste);
      this.updateContentFromEditor();
    }
  }

  private cleanupEditorContent() {
    if (!this.contentEditor?.nativeElement) return;
    
    const editor = this.contentEditor.nativeElement;
    let content = editor.innerHTML;
    
    // Clean up common contenteditable issues
    content = content
      .replace(/<div><br><\/div>/g, '<p><br></p>') // Convert empty divs to paragraphs
      .replace(/<div>/g, '<p>') // Convert divs to paragraphs
      .replace(/<\/div>/g, '</p>')
      .replace(/<p><\/p>/g, '<p><br></p>') // Add br to empty paragraphs
      .replace(/&nbsp;/g, ' ') // Convert non-breaking spaces
      .trim();
    
    if (content !== editor.innerHTML) {
      // Save cursor position
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      
      // Update content
      editor.innerHTML = content;
      
      // Restore cursor position to end if we can't determine exact position
      if (range && editor.lastChild) {
        try {
          const newRange = document.createRange();
          newRange.setStart(editor.lastChild, editor.lastChild.textContent?.length || 0);
          newRange.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(newRange);
        } catch (error) {
          // If cursor restoration fails, just focus the editor
          editor.focus();
        }
      }
      
      this.formData.content = content;
    }
  }

  // Tags
  addTag(event: Event) {
    event.preventDefault();
    const tag = this.tagsInput.trim();
    if (tag && !this.selectedTags.includes(tag) && this.selectedTags.length < 5) {
      this.selectedTags.push(tag);
      this.tagsInput = '';
    }
  }

  removeTag(tagToRemove: string) {
    this.selectedTags = this.selectedTags.filter(tag => tag !== tagToRemove);
  }

  // Emoji
  selectEmoji(emoji: string) {
    this.formData.emoji = emoji;
    this.showEmojiSuggestions = false;
  }

  hideEmojiSuggestions() {
    setTimeout(() => {
      this.showEmojiSuggestions = false;
    }, 150);
  }

  // Modal
  openPublishModal() {
    if (!this.canSave()) return;
    this.showPublishModal = true;
    document.body.style.overflow = 'hidden';
  }

  closePublishModal() {
    this.showPublishModal = false;
    document.body.style.overflow = '';
  }

  // Submission methods
  async submitStory() {
    if (!this.currentUser || this.isSubmitting || !this.isValidForPublish()) return;

    this.isSubmitting = true;
    this.clearMessages();
    this.formData.status = 'published';

    try {
      const storyData: CreateStoryData = {
        ...this.formData as CreateStoryData,
        tags: this.selectedTags,
        readTime: this.getReadTime(),
        status: 'published' as StoryStatus,
      };

      const result = await this.storiesService.createStory(storyData);
      
      this.showSuccess('Story published successfully!');
      this.closePublishModal();
      
      setTimeout(() => {
        this.router.navigate(['/story', result.id]);
      }, 2000);

    } catch (error) {
      console.error('Error publishing story:', error);
      this.showError('Failed to publish story. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }

  async saveDraft() {
    if (!this.currentUser || this.isSubmitting || !this.canSave()) return;

    this.isSubmitting = true;
    this.clearMessages();
    this.formData.status = 'draft';

    try {
      const draftData: CreateDraftData = {
        ...this.formData as CreateDraftData,
        tags: this.selectedTags,
        readTime: this.getReadTime(),
        authorId: this.currentUser.uid,
        authorName: this.currentUser.displayName || 'Anonymous',
        isPublic: false,
        language: this.formData.language || 'en',
      };

      await this.draftsService.createDraft(draftData);
      
      this.isDraftSaved = true;
      this.saveDraftToLocal();
      
      setTimeout(() => {
        this.isDraftSaved = false;
      }, 3000);

    } catch (error) {
      console.error('Error saving draft:', error);
      this.showError('Failed to save draft. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }

  // Local storage
  private loadDraft() {
    const saved = localStorage.getItem('story-draft');
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        this.formData = { ...this.formData, ...draft };
        this.selectedTags = draft.tags || [];
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
  }

  private saveDraftToLocal() {
    const draftData = {
      ...this.formData,
      tags: this.selectedTags
    };
    localStorage.setItem('story-draft', JSON.stringify(draftData));
  }

  // Auto-save
  private setupAutoSave() {
    this.autoSaveInterval = window.setInterval(() => {
      if (this.canSave() && !this.isSubmitting) {
        this.saveDraftToLocal();
      }
    }, 30000);
  }

  // Keyboard shortcuts
  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 's':
            event.preventDefault();
            if (this.canSave()) {
              this.saveDraft();
            }
            break;
          case 'Enter':
            event.preventDefault();
            if (this.canSave()) {
              this.openPublishModal();
            }
            break;
        }
      }
    });
  }

  // Message handling
  private showSuccess(message: string) {
    this.successMessage = message;
    setTimeout(() => {
      this.successMessage = '';
    }, 5000);
  }

  private showError(message: string) {
    this.errorMessage = message;
    setTimeout(() => {
      this.errorMessage = '';
    }, 5000);
  }

  private clearMessages() {
    this.successMessage = '';
    this.errorMessage = '';
  }
}