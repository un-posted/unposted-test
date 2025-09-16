import { Component, ElementRef, inject, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ViewsService } from '../../services/views.service';
import { CommentService } from '../../services/comment.service';
import { VoteService } from '../../services/vote.service';
import { StoryService } from '../../services/story.service';
import { Comment } from '../../models'
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification.service';
import { ProfileService } from '../../services/profile.service';


@Component({
  selector: 'app-story',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './story.html',
  styleUrl: './story.scss'
})
export class Story implements OnInit, OnDestroy {
  //private storiesService = inject(StoriesService);
  private storyService = inject(StoryService);
  private commentsService = inject(CommentService);
  private votesService = inject(VoteService);
  private viewsService = inject(ViewsService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private profileService = inject(ProfileService);

  @Input() storyId!: string;
  @ViewChild('articleContent', { static: false }) articleContent!: ElementRef;

  // State
  story: any = null;
  comments: any[] = [];
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
  //private userSubscription?: Subscription;

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
    this.authService.user$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadUserVoteStatus();
      } 
    });

    // Track scroll for reading progress
    window.addEventListener('scroll', this.updateReadingProgress.bind(this));
  }

  ngOnDestroy() {
    if (this.currentUser) {
      this.currentUser = null;
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

      this.story = await this.storyService.getStory(id);
      
      if (!this.story) {
        this.errorMessage = 'Story not found. It may have been deleted or moved.';
        return;
      }

      // Load related data
      await Promise.all([
        this.loadComments(),
        //this.loadVoteCount(),
        //this.loadViewCount(),
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
      await this.viewsService.trackView(this.storyId);
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
      this.hasUpvoted = await this.votesService.hasVoted(this.storyId);
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
      this.story.stats.voteCount += this.hasUpvoted ? 1 : -1;
      if(this.hasUpvoted)
        {
          this.notificationService.notifyStoryLiked(this.story.authorId,this.currentUser.displayName, this.story.title , this.storyId);
          this.profileService.awardUserXP(this.currentUser.uid,1,'liked a story')
        }

      await this.votesService.toggleVote(this.storyId);
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
  username: this.currentUser.displayName,
  userPhotoURL: this.currentUser.photoURL, // optional
  content: this.commentText.trim()
      };
      
      await this.commentsService.addComment(this.storyId, commentData);
      this.notificationService.notifyStoryCommented(this.story.authorId,this.currentUser.displayName,this.story.title,this.storyId);
      this.profileService.awardUserXP(this.currentUser.uid,2,'commented a story')
      
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
      await this.commentsService.deleteOwnComment(this.storyId, commentId, this.currentUser.uid);
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
