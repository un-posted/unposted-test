import { AfterViewInit, Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { StoryStatus } from '../../models/firestore';
import { AuthService } from '../../services/auth.service';
import { StoryService } from '../../services/story.service';
import { Story } from '../../models';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProfileService } from '../../services/profile.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-write',
  imports: [CommonModule, FormsModule,RouterModule],
  templateUrl: './write.html',
  styleUrl: './write.scss'
})
export class Write implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild('contentEditor') contentEditor!: ElementRef;
    
    private storyService = inject(StoryService);
    private authService = inject(AuthService);
    private router = inject(Router);
    private profileService = inject(ProfileService);
    private notificationService = inject(NotificationService);
    

    // Component properties
    currentUser: any = null;
    authLoading = true;
    isSubmitting = false;
    successMessage = '';
    errorMessage = '';
    tagsInput = '';
    selectedTags: string[] = [];
    suggestedTags: string[] = [];
    showPublishModal = false;
    showCoverOptions = false;
    showToolbar = false;
    showEmojiSuggestions = false;
    showDraftRecovery = false;
    isDraftSaved = false;
    isRTL = false;

    // Enhanced auto-save properties
    autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
    lastSavedTime: Date | null = null;
    recoveredDraft: any = null;

    // Editor properties
    private selectionRange: Range | null = null;
    private toolbarTimeout?: number;
    private isInitialized = false;
    private retryCount = 0;
    private maxRetries = 2;

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
    formData: Partial<Omit<Story, 'id' | 'createdAt' | 'updatedAt' | 'stats'>> = {
      category: '',
      language: '',
      emoji: '',
      title: '',
      content: '',
      coverImg: '',
      status: 'published',
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
          this.formData.authorPhotoURL = user.photoURL || '';
        }
      });

      this.checkForExistingDraft();
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
      
      document.removeEventListener('selectionchange', this.handleSelectionChange.bind(this));
      this.clearMessages();
    }

    // Enhanced draft recovery
    private checkForExistingDraft() {
      const saved = localStorage.getItem('story-draft');
      if (saved && saved !== '{}') {
        try {
          const draft = JSON.parse(saved);
          if (draft.title || (draft.content && draft.content.length > 20)) {
            this.recoveredDraft = draft;
            this.showDraftRecovery = true;
            this.showSuccess('Previous draft found. Restore it or start fresh.');
          }
        } catch (error) {
          console.error('Error checking draft:', error);
        }
      }
    }

    restoreDraft() {
      if (this.recoveredDraft) {
        this.formData = { ...this.formData, ...this.recoveredDraft };
        this.selectedTags = this.recoveredDraft.tags || [];
        this.showDraftRecovery = false;
        
        // Update editor content if initialized
        if (this.contentEditor?.nativeElement && this.formData.content) {
          this.contentEditor.nativeElement.innerHTML = this.formData.content;
        }
        
        this.showSuccess('Draft restored successfully!');
      }
    }

    dismissDraftRecovery() {
      this.showDraftRecovery = false;
      localStorage.removeItem('story-draft');
      this.recoveredDraft = null;
    }

    // Enhanced auto-save with status feedback
    private setupAutoSave() {
      this.autoSaveInterval = window.setInterval(() => {
        if (this.canSave() && !this.isSubmitting && !this.showDraftRecovery) {
          this.autoSaveStatus = 'saving';
          
          try {
            this.saveDraftToLocal();
            this.autoSaveStatus = 'saved';
            this.lastSavedTime = new Date();
            
            setTimeout(() => {
              this.autoSaveStatus = 'idle';
            }, 2000);
          } catch (error) {
            this.autoSaveStatus = 'error';
            console.error('Auto-save failed:', error);
          }
        }
      }, 30000);
    }

    getTimeSince(): string {
      if (!this.lastSavedTime) return '';
      
      const now = new Date();
      const diff = Math.floor((now.getTime() - this.lastSavedTime.getTime()) / 1000);
      
      if (diff < 60) return 'just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      return `${Math.floor(diff / 3600)}h ago`;
    }

    // Character count with visual feedback
    getTitleCharacterInfo() {
      const length = this.formData.title?.length || 0;
      const limit = 200;
      const percentage = (length / limit) * 100;
      
      return {
        count: length,
        limit,
        percentage,
        isWarning: percentage >= 80,
        isError: percentage >= 95,
        shouldShow: percentage >= 70
      };
    }

    // Writing progress tracking
    getWritingProgress() {
      const requirements = {
        hasTitle: !!this.formData.title && this.formData.title.length >= 3,
        hasContent: !!this.formData.content && this.formData.content.length >= 100,
        hasCategory: !!this.formData.category,
        hasLanguage: !!this.formData.language,
        hasEmoji: !!this.formData.emoji,
        hasMinimumWords: this.getWordCount() >= 50
      };
      
      const completed = Object.values(requirements).filter(Boolean).length;
      const total = Object.keys(requirements).length;
      
      return {
        percentage: Math.round((completed / total) * 100),
        completed,
        total,
        requirements,
        shouldShow: this.formData.title || this.formData.content
      };
    }

    // Smart tag suggestions
    private generateTagSuggestions() {
      const content = this.formData.content?.toLowerCase() || '';
      const title = this.formData.title?.toLowerCase() || '';
      const category = this.formData.category?.toLowerCase() || '';
      const text = `${title} ${content} ${category}`;
      
      const tagMappings = {
        'travel': ['adventure', 'journey', 'exploration', 'culture'],
        'work': ['career', 'professional', 'business', 'leadership'],
        'family': ['relationships', 'love', 'home', 'parenting'],
        'personal': ['growth', 'self-improvement', 'reflection', 'mindfulness'],
        'creative': ['art', 'design', 'inspiration', 'creativity'],
        'health': ['wellness', 'fitness', 'mental-health', 'lifestyle'],
        'learning': ['education', 'knowledge', 'skills', 'development'],
        'challenge': ['resilience', 'strength', 'perseverance', 'courage'],
        'story': ['narrative', 'experience', 'life-lessons', 'wisdom']
      };
      
      this.suggestedTags = [];
      
      Object.entries(tagMappings).forEach(([key, tags]) => {
        if (text.includes(key)) {
          this.suggestedTags.push(...tags);
        }
      });
      
      // Remove duplicates, existing tags, and limit to 5
      this.suggestedTags = [...new Set(this.suggestedTags)]
        .filter(tag => !this.selectedTags.includes(tag))
        .slice(0, 5);
    }

    selectSuggestedTag(tag: string) {
      if (this.selectedTags.length < 5 && !this.selectedTags.includes(tag)) {
        this.selectedTags.push(tag);
        this.generateTagSuggestions(); // Refresh suggestions
      }
    }

    // Enhanced submission with retry logic
    private async submitWithRetry(submitFunction: () => Promise<any>): Promise<any> {
      let attempts = 0;
      
      while (attempts <= this.maxRetries) {
        try {
          return await submitFunction();
        } catch (error) {
          attempts++;
          
          if (attempts > this.maxRetries) {
            throw error;
          }
          
          this.showError(`Connection issue. Retrying... (${this.maxRetries - attempts + 1} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
    }

    // Editor initialization
    private initializeEditor() {
      if (this.isInitialized || !this.contentEditor?.nativeElement) return;
      
      const editor = this.contentEditor.nativeElement;
      
      if (this.formData.content) {
        editor.innerHTML = this.formData.content;
      } else {
        editor.innerHTML = '<p><br></p>';
      }
      
      editor.setAttribute('spellcheck', 'true');
      editor.setAttribute('autocomplete', 'off');
      editor.setAttribute('autocorrect', 'on');
      editor.setAttribute('autocapitalize', 'sentences');
      
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
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          this.showError('Image size must be less than 5MB');
          return;
        }
        
        if (!file.type.startsWith('image/')) {
          this.showError('Please select a valid image file');
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          this.formData.coverImg = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    }

    removeCover() {
      this.formData.coverImg = '';
      this.showCoverOptions = false;
    }

    changeCover() {
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
      
      const textContent = element.textContent || '';
      const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F]/;
      const hasRTL = rtlRegex.test(textContent);
      
      if (hasRTL !== this.isRTL) {
        this.isRTL = hasRTL;
      }
      
      if (this.formData.content !== content) {
        this.formData.content = content;
        
        // Generate tag suggestions for longer content
        if (this.formData.content && this.formData.content.length > 100) {
          this.generateTagSuggestions();
        }
      }
    }

    onEditorKeydown(event: KeyboardEvent) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        document.execCommand('formatBlock', false, 'p');
        document.execCommand('insertParagraph', false);
        
        setTimeout(() => {
          this.cleanupEditorContent();
        }, 0);
      }
      
      if (event.key === 'Tab') {
        event.preventDefault();
        document.execCommand('insertText', false, '    ');
      }
    }

    onEditorKeyup(event: KeyboardEvent) {
      this.updateContentFromEditor();
      
      if (event.key === 'Escape') {
        this.showToolbar = false;
      }
    }

    onEditorFocus() {
      document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));
    }

    onEditorBlur() {
      document.removeEventListener('selectionchange', this.handleSelectionChange.bind(this));
      this.hideToolbarDelayed();
    }

    private handleSelectionChange() {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        this.hideToolbarDelayed();
        return;
      }

      const range = selection.getRangeAt(0);
      const editorElement = this.contentEditor?.nativeElement;
      
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

    private showToolbarAtSelection() {
      if (this.toolbarTimeout) {
        clearTimeout(this.toolbarTimeout);
      }
      
      this.showToolbar = true;
      
      setTimeout(() => {
        this.updateToolbarPosition();
      }, 0);
    }

    formatText(command: string, value?: string) {
      if (this.selectionRange) {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(this.selectionRange);
        }
      }
      
      document.execCommand(command, false, value);
      this.updateContentFromEditor();
      this.contentEditor?.nativeElement.focus();
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
      
      const rect = this.selectionRange.getBoundingClientRect();
      const toolbar = document.querySelector('.editor-toolbar') as HTMLElement;
      
      if (toolbar) {
        const toolbarRect = toolbar.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        
        let top = rect.top - toolbarRect.height - 10;
        let left = rect.left + (rect.width / 2) - (toolbarRect.width / 2);
        
        if (left < 10) left = 10;
        if (left + toolbarRect.width > viewportWidth - 10) {
          left = viewportWidth - toolbarRect.width - 10;
        }
        if (top < 10) {
          top = rect.bottom + 10;
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
        document.execCommand('insertText', false, paste);
        this.updateContentFromEditor();
      }
    }

    private cleanupEditorContent() {
      if (!this.contentEditor?.nativeElement) return;
      
      const editor = this.contentEditor.nativeElement;
      let content = editor.innerHTML;
      
      content = content
        .replace(/<div><br><\/div>/g, '<p><br></p>')
        .replace(/<div>/g, '<p>')
        .replace(/<\/div>/g, '</p>')
        .replace(/<p><\/p>/g, '<p><br></p>')
        .replace(/&nbsp;/g, ' ')
        .trim();
      
      if (content !== editor.innerHTML) {
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        
        editor.innerHTML = content;
        
        if (range && editor.lastChild) {
          try {
            const newRange = document.createRange();
            newRange.setStart(editor.lastChild, editor.lastChild.textContent?.length || 0);
            newRange.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(newRange);
          } catch (error) {
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
        this.generateTagSuggestions();
      }
    }

    removeTag(tagToRemove: string) {
      this.selectedTags = this.selectedTags.filter(tag => tag !== tagToRemove);
      this.generateTagSuggestions();
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
      this.generateTagSuggestions(); // Generate fresh suggestions
      this.showPublishModal = true;
      document.body.style.overflow = 'hidden';
    }

    closePublishModal() {
      this.showPublishModal = false;
      document.body.style.overflow = '';
    }

    // Enhanced submission methods
    async submitStory() {
      if (!this.currentUser || this.isSubmitting || !this.isValidForPublish()) return;

      this.isSubmitting = true;
      this.clearMessages();
      this.formData.status = 'published';

      try {
        await this.submitWithRetry(async () => {
          const storyData = {
            title: this.formData.title!,
            content: this.formData.content!,
            category: this.formData.category!,
            language: this.formData.language!,
            emoji: this.formData.emoji!,
            coverImg: this.formData.coverImg || '',
            status: 'published' as const,
            tags: this.selectedTags,
            authorId: this.currentUser.uid,
            authorName: this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'Anonymous',
            authorPhotoURL: this.currentUser.photoURL || ''
          };

          const storyId = await this.storyService.createStory(storyData);

          this.notificationService.notifyStoryPublished(this.currentUser.uid,this.formData.title,storyId)
          this.profileService.awardUserXP(this.currentUser.uid,25,'posted a story')
        });
        
        this.showSuccess('Story published successfully!'); 
        this.closePublishModal();
        localStorage.removeItem('story-draft'); // Clear draft after successful publish
        
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 2000);

      } catch (error) {
        console.error('Error publishing story:', error);
        this.showError('Failed to publish story after multiple attempts. Please check your connection and try again.');
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
        await this.submitWithRetry(async () => {
          const storyData = {
            title: this.formData.title!,
            content: this.formData.content!,
            category: this.formData.category || '',
            language: this.formData.language || '',
            emoji: this.formData.emoji || '📝',
            coverImg: this.formData.coverImg || '',
            status: 'draft' as const,
            tags: this.selectedTags,
            authorId: this.currentUser.uid,
            authorName: this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'Anonymous',
            authorPhotoURL: this.currentUser.photoURL || ''
          };
          this.profileService.awardUserXP(this.currentUser.uid,10,'saved a draft')
          return await this.storyService.createStory(storyData);
          
        });
        
        this.showSuccess('Draft saved successfully!');
        this.closePublishModal();
        localStorage.removeItem('story-draft'); // Clear local draft after server save
        
        setTimeout(() => {
          this.router.navigate(['/profile']);
        }, 2000);

      } catch (error) {
        console.error('Error saving draft:', error);
        this.showError('Failed to save draft after multiple attempts. Please check your connection and try again.');
      } finally {
        this.isSubmitting = false;
      }
    }

    // Enhanced local storage
    private saveDraftToLocal() {
      const draftData = {
        ...this.formData,
        tags: this.selectedTags,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('story-draft', JSON.stringify(draftData));
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

    // Enhanced message handling
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
      }, 8000); // Longer timeout for errors
    }

     clearMessages() {
      this.successMessage = '';
      this.errorMessage = '';
    }
}