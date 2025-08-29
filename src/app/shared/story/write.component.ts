import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StoriesService } from '../story/services/story.service';
import { AuthService } from '../../auth/auth';
import { CreateStoryData } from '../models/story';
import { StoryStatus } from '../models/firestore';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-write-story',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Authentication Check -->
    <div *ngIf="!currentUser && !authLoading" class="auth-required">
      <div class="auth-container">
        <h1 class="auth-logo">✍️ Write</h1>
        <h2>Share Your Story</h2>
        <p>Join our community and tell the stories that matter to you.</p>
        <div class="auth-buttons">
          <a routerLink="/login" class="btn-primary">Sign In</a>
          <a routerLink="/register" class="btn-secondary">Join Us</a>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div *ngIf="authLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>

    <!-- Write Story Form (for authenticated users) -->
    <div *ngIf="currentUser && !authLoading" class="write-story-container">
      <!-- Header -->
      <header class="header">
        <div class="autosave-indicator" [class.visible]="successMessage">
          {{ successMessage }}
        </div>
      </header>

      <!-- Error Message -->
      <div *ngIf="errorMessage" class="message error-message">
        {{ errorMessage }}
      </div>

      <form class="story-form" (ngSubmit)="submitStory()" #storyForm="ngForm">
        
        <!-- Basic Info Row -->
        <div class="form-row">
          <select [(ngModel)]="formData.category" name="category" required class="select-input">
            <option value="" disabled selected>Category</option>
            <option *ngFor="let c of categories" [value]="c">{{ c }}</option>
          </select>
          
          <select [(ngModel)]="formData.language" name="language" required class="select-input">
            <option value="" disabled selected>Language</option>
            <option *ngFor="let l of languages" [value]="l.value">{{ l.label }}</option>
          </select>
          
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
        </div>

        <!-- Title -->
        <input
          type="text"
          class="title-input"
          [(ngModel)]="formData.title"
          name="title"
          placeholder="Title"
          maxlength="200"
          required
        />

        <!-- Subtitle -->
        <input
          type="text"
          class="subtitle-input"
          [(ngModel)]="formData.excerpt"
          name="excerpt"
          placeholder="Brief summary (optional)"
          maxlength="150"
        />

        <!-- Floating Toolbar -->
        <div class="editor-toolbar">
          <button type="button" (click)="formatText('bold')"><b>B</b></button>
          <button type="button" (click)="formatText('italic')"><i>I</i></button>
          <button type="button" (click)="formatText('underline')"><u>U</u></button>
          <button type="button" (click)="formatText('insertUnorderedList')">•</button>
          <button type="button" (click)="formatText('insertOrderedList')">1.</button>
          <button type="button" (click)="formatText('formatBlock', 'h2')">H2</button>
          <button type="button" (click)="toggleDirection()">{{ isRTL ? 'LTR' : 'RTL' }}</button>
          <!--<button type="button" (click)="toggleWritingAssistant()">💡</button>-->
        </div>

        <!-- Content Editor -->
        <div class="editor-container">
          <div
  class="content-editor"
  [class.rtl]="isRTL"
  contenteditable="true"
  (input)="onContentInput($event)"
  (blur)="onContentBlur($event)"
  [innerHTML]="formData.content"
  placeholder="Tell your story..."
  [attr.dir]="isRTL ? 'rtl' : 'ltr'"
  #contentEditor
></div>
          
          <!-- Writing Assistant -->
          <div class="writing-assistant" *ngIf="showWritingAssistant">
            <div class="assistant-header">
              <span>Writing Tips</span>
              <button type="button" (click)="toggleWritingAssistant()">×</button>
            </div>
            <div class="assistant-content">
              <div *ngFor="let suggestion of writingSuggestions" class="tip">
                {{ suggestion }}
              </div>
            </div>
          </div>
        </div>

        <!-- Editor Stats -->
        <div class="editor-stats">
          <span>{{ getWordCount() }} words</span>
          <span>{{ getReadTime() }} min read</span>
          <span>{{ formData.content?.length || 0 }} / 10,000 chars</span>
        </div>

        <!-- Tags -->
        <!-- Tags -->
<div class="tag-section">
  <!-- Display selected tags -->
  
  
  <!-- Input for new tags -->
  <input
    type="text"
    [(ngModel)]="tagsInput"
    name="tags"
    placeholder="Add tags (press Enter)"
    class="tags-input"
    (keydown.enter)="addTag($event)"
  />

  <div class="selected-tags" *ngIf="selectedTags.length > 0">
    <span *ngFor="let tag of selectedTags" class="tag-chip">
      {{ tag }}
      <button type="button" (click)="removeTag(tag)" class="tag-remove">×</button>
    </span>
  </div>
</div>

        <!-- Visibility Toggle 
        <div class="visibility-section">
          <label class="checkbox-label">
            <input type="checkbox" [(ngModel)]="formData.isPublic" name="isPublic" />
            <span class="checkbox-text">Make story discoverable by others</span>
          </label>
        </div>-->

        <!-- Actions -->
        <div class="form-actions">
          <button type="button" class="btn-secondary" (click)="saveDraft()" [disabled]="!canSave() || isSubmitting">
            {{ isSubmitting && formData.status === 'draft' ? 'Saving...' : 'Save Draft' }}
          </button>
          <button type="submit" class="btn-primary" [disabled]="!storyForm.form.valid || isSubmitting">
            {{ isSubmitting && formData.status === 'published' ? 'Publishing...' : 'Publish' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    :host {
      --bg: #fafafa;
      --text: #242424;
      --muted: #666;
      --border: #e5e5e5;
      --accent: #fbbf24;;
      --error: #e63946;
      --success: #22c55e;
    }

    /* Auth Required */
    .auth-required {
      min-height: 100vh;
      background: var(--bg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .auth-container {
      text-align: center;
      background: white;
      padding: 3rem 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      max-width: 400px;
    }

    .auth-logo {
      font-size: 2rem;
      margin-bottom: 1rem;
      color: var(--text);
    }

    .auth-container h2 {
      margin-bottom: 1rem;
      color: var(--text);
      font-weight: 600;
    }

    .auth-container p {
      color: var(--muted);
      margin-bottom: 2rem;
    }

    .auth-buttons {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .auth-buttons a {
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s;
    }

    /* Loading State */
    .loading-state {
      min-height: 100vh;
      background: var(--bg);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    /* Main Container */
    .write-story-container {
      min-height: 100vh;
      background: white;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    /* Header */
    .header {
      width: 100%;
      max-width: 800px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .logo {
      font-size: 1.5rem;
      font-weight: bold;
      color: var(--text);
      margin: 0;
    }

    .user-info {
      color: var(--muted);
      font-size: 0.9rem;
    }

    .autosave-indicator {
      font-size: 0.9rem;
      color: var(--success);
      opacity: 0;
      transition: opacity .3s;
    }
    .autosave-indicator.visible { opacity: 1; }

    /* Messages */
    .message {
      width: 100%;
      max-width: 800px;
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }

    .error-message {
      background: #fef2f2;
      color: var(--error);
      border: 1px solid #fecaca;
    }

    /* Story Form */
    .story-form {
      width: 100%;
      max-width: 800px;
      display: flex;
      flex-direction: column;
    }

    /* Form Row */
    .form-row {
      display: grid;
      grid-template-columns: 2fr 2fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
        position: relative; /* Add this */

    }

    .select-input {
  padding: 0.75rem 2.5rem 0.75rem 0.75rem; /* Add right padding for arrow */
  border: 2px solid var(--border);
  border-radius: 8px;
  background: white url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e") no-repeat right 0.75rem center;
  background-size: 16px;
  font-size: 1rem;
  outline: none;
  transition: all 0.2s;
  appearance: none;
  cursor: pointer;
}

.select-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.1);
}

.select-input:hover {
  border-color: #d1d5db;
}

    .emoji-input {
      padding: 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: white;
      font-size: 1.5rem;
      text-align: center;
      outline: none;
      transition: border-color 0.2s;
    }

    .emoji-input:focus {
      border-color: var(--accent);
    }

    /* Title and Subtitle */
    .title-input {
      font-size: 2.5rem;
      font-weight: 700;
      border: none;
      outline: none;
      background: transparent;
      margin-bottom: 1rem;
      color: var(--text);
    }

    .title-input::placeholder {
      color: var(--muted);
    }

    .subtitle-input {
      font-size: 1.3rem;
      font-weight: 400;
      border: none;
      outline: none;
      background: transparent;
      color: var(--muted);
      margin-bottom: 2rem;
    }

    .subtitle-input::placeholder {
      color: var(--muted);
    }

    /* Toolbar */
    .editor-toolbar {
      display: flex;
      gap: 0.5rem;
      padding: 0.5rem;
      background: white;
      border: 1px solid var(--border);
      border-radius: 6px;
      align-self: center;
      margin-bottom: 1rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }

    .editor-toolbar button {
      border: none;
      background: none;
      padding: 0.4rem 0.7rem;
      font-size: 1rem;
      cursor: pointer;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .editor-toolbar button:hover {
      background: var(--border);
    }

    /* Editor Container */
    .editor-container {
      position: relative;
      margin-bottom: 1rem;
    }

    .content-editor {
  min-height: 400px;
  padding: 1rem 0;
  font-size: 1.2rem;
  line-height: 1.8;
  font-family: Georgia, "Times New Roman", serif;
  color: var(--text);
  border: none;
  outline: none;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.content-editor:empty::before {
  content: attr(placeholder);
  color: var(--muted);
  font-style: italic;
}

.content-editor.rtl {
  direction: rtl;
  text-align: right;
  unicode-bidi: plaintext;
}

.content-editor.rtl * {
  direction: rtl;
  text-align: right;
}

/* Fix for mixed content */
.content-editor[dir="rtl"] {
  direction: rtl;
  text-align: start;
}

.content-editor[dir="ltr"] {
  direction: ltr;
  text-align: start;
}

    /* Writing Assistant */
    .writing-assistant {
      position: absolute;
      top: 0;
      right: 0;
      width: 300px;
      background: white;
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      z-index: 10;
    }

    .assistant-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid var(--border);
      font-weight: 600;
    }
    .content-editor.rtl {
  direction: rtl;
  text-align: right;
}

.content-editor.rtl h2,
.content-editor.rtl p {
  text-align: right;
}
    .assistant-header button {
      border: none;
      background: none;
      font-size: 1.2rem;
      cursor: pointer;
      color: var(--muted);
    }

    .assistant-content {
      padding: 1rem;
    }

    .tip {
      font-size: 0.9rem;
      color: var(--muted);
      margin-bottom: 0.75rem;
      padding: 0.5rem;
      background: #f8f9fa;
      border-radius: 4px;
    }

    .tip:last-child {
      margin-bottom: 0;
    }

    /* Editor Stats */
    .editor-stats {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
      color: var(--muted);
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }

    /* Tags */
    .tag-section {
      margin-bottom: 1rem;
    }

    .tags-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 1rem;
      outline: none;
      transition: border-color 0.2s;
    }

    .tags-input:focus {
      border-color: var(--accent);
    }
.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  background: var(--accent);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 16px;
  font-size: 0.85rem;
  gap: 0.25rem;
}

.tag-remove {
  border: none;
  background: none;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  line-height: 1;
}
    /* Visibility */
    .visibility-section {
      margin-bottom: 2rem;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      font-size: 0.9rem;
      color: var(--muted);
    }

    .checkbox-label input[type="checkbox"] {
      margin: 0;
    }

    /* Actions */
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid var(--border);
    }

    .btn-primary {
      background: #fbbf24;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: background .2s;
      text-decoration: none;
      display: inline-block;
      text-align: center;
    }

    .btn-primary:hover:not(:disabled) {
      background: #f59e0b;
    }

    .btn-secondary {
      background: white;
      border: 1px solid var(--border);
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-block;
      text-align: center;
      color: var(--text);
    }

    .btn-secondary:hover:not(:disabled) {
      background: #f5f5f5;
    }

    .btn-primary:disabled,
    .btn-secondary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Spinner */
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid var(--accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .write-story-container {
        padding: 1rem;
      }

      .form-row {
        grid-template-columns: 1fr;
      }

      .title-input {
        font-size: 2rem;
      }

      .subtitle-input {
        font-size: 1.1rem;
      }

      .writing-assistant {
        position: static;
        width: 100%;
        margin-top: 1rem;
      }

      .form-actions {
        flex-direction: column;
      }
    }

    @media (max-width: 480px) {
      .header {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
      }

      .title-input {
        font-size: 1.8rem;
      }
    }

    .emoji-container {
  position: relative;
}

.emoji-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.25rem;
  padding: 0.5rem;
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
  background: var(--border);
}
  `]
})
export class WriteStoryComponent implements OnInit, OnDestroy {
  private storiesService = inject(StoriesService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // Component properties
  currentUser: any = null;
  authLoading = true;
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';
  tagsInput = '';
  showWritingAssistant = false;
  selectedTags: string[] = [];

  showEmojiSuggestions = false;
emojiSuggestions = [
  '📝', '✍️', '📖', '💭', '🌟', '❤️', '🔥', '💡',
  '🎯', '🚀', '🌈', '✨', '💪', '🙏', '😊', '🎉',
  '🌍', '🏔️', '🌊', '🎨', '🎵', '📚', '⭐', '💫'
];

  // Content suggestions
  writingSuggestions = [
    "Start with a moment that changed everything",
    "Show, don't just tell - use specific details",
    "What would you tell your younger self?",
    "Focus on one powerful moment rather than a timeline",
    "What lesson did this experience teach you?",
    "How did this make you feel, and why?"
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
    status: 'published' as StoryStatus,
    isPublic: true,
    tags: []
  };


  isRTL = false; // Add this property

// Add method to toggle direction
toggleDirection() {
  this.isRTL = !this.isRTL;
}

  private userSubscription?: Subscription;

  ngOnInit() {
    this.userSubscription = this.authService.user$.subscribe(user => {
      this.currentUser = user;
      this.authLoading = false;
      
      if (user) {
        this.formData.authorId = user.uid;
        this.formData.authorName = user.displayName || user.email?.split('@')[0] || 'Anonymous';
      }
    });

    const saved = localStorage.getItem('draft');
    if (saved) this.formData = JSON.parse(saved);

    // Auto-save setup
    this.setupAutoSave();
    this.setupKeyboardShortcuts();
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  // User methods
  getUserName(): string {
    if (!this.currentUser) return '';
    return this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'Writer';
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

  // Editor functionality
  formatText(command: string, value?: string) {
    document.execCommand(command, false, value);
  }

  onContentChange(event: any) {
    this.formData.content = event.target.innerHTML;
  }

  onContentBlur(event: any) {
    this.formData.content = event.target.innerHTML;
  }

  toggleWritingAssistant() {
    this.showWritingAssistant = !this.showWritingAssistant;
  }

  // Submission methods
  async submitStory() {
    if (!this.currentUser || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.formData.status = 'published';

    try {
      const tags = this.selectedTags;


      const storyData: CreateStoryData = {
        ...this.formData as CreateStoryData,
        tags,
        readTime: this.getReadTime(),
        status: 'published' as StoryStatus,
      };

      const result = await this.storiesService.createStory(storyData);
      
      this.successMessage = 'Story published successfully!';
      
      setTimeout(() => {
        this.router.navigate(['/story', result.id]);
      }, 2000);

    } catch (error) {
      console.error('Error publishing story:', error);
      this.errorMessage = 'Failed to publish story. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }

  async saveDraft() {
    if (!this.currentUser || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';
    this.formData.status = 'draft';

    try {
      const tags = this.tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .slice(0, 10);

      const storyData: CreateStoryData = {
        ...this.formData as CreateStoryData,
        tags,
        readTime: this.getReadTime(),
        status: 'draft' as StoryStatus,
      };
      
      await this.storiesService.createStory(storyData);
      
      this.successMessage = 'Draft saved successfully!';
      
      setTimeout(() => {
        this.successMessage = '';
      }, 3000);

    } catch (error) {
      console.error('Error saving draft:', error);
      this.errorMessage = 'Failed to save draft. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }

  // Auto-save functionality
  private setupAutoSave() {
    setInterval(() => {
      if (this.canSave() && !this.isSubmitting) {
        // Auto-save logic here if needed
            localStorage.setItem('draft', JSON.stringify(this.formData));

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
        }
      }
    });
  }
addTag(event: Event) {
  event.preventDefault();
  const tag = this.tagsInput.trim();
  if (tag && !this.selectedTags.includes(tag) && this.selectedTags.length < 10) {
    this.selectedTags.push(tag);
    this.tagsInput = '';
  }
}

removeTag(tagToRemove: string) {
  this.selectedTags = this.selectedTags.filter(tag => tag !== tagToRemove);
}

  selectEmoji(emoji: string) {
  this.formData.emoji = emoji;
  this.showEmojiSuggestions = false;
}

hideEmojiSuggestions() {
  // Delay to allow click events to fire
  setTimeout(() => {
    this.showEmojiSuggestions = false;
  }, 150);
}



onContentInput(event: any) {
  const element = event.target;
  const text = element.textContent || '';
  
  // Auto-detect RTL text (Arabic, Hebrew, etc.)
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F]/;
  const hasRTL = rtlRegex.test(text);
  
  if (hasRTL && !this.isRTL) {
    this.isRTL = true;
  }
  
  this.onContentChange(event);
}
}