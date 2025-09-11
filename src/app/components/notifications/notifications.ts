import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { Notification } from '../../models';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-notifications',
  imports: [CommonModule, RouterModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss'
})
export class Notifications implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  unreadCount: number = 0;
  user: User | null = null;
  loading: boolean = true;
  selectedFilter: 'all' | 'unread' = 'all';
  
  private notificationsSubscription?: Subscription;
  private unreadCountSubscription?: Subscription;
  private userSubscription?: Subscription;

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe to user authentication state
    this.userSubscription = this.authService.user$.subscribe(user => {
      this.user = user;
      if (!user) {
        this.router.navigate(['/login']);
      }
    });

    // Subscribe to notifications
    this.notificationsSubscription = this.notificationService.notifications$.subscribe(
      notifications => {
        this.notifications = notifications;
        this.loading = false;
      }
    );

    // Subscribe to unread count
    this.unreadCountSubscription = this.notificationService.unreadCount$.subscribe(
      count => {
        this.unreadCount = count;
      }
    );
  }

  ngOnDestroy(): void {
    if (this.notificationsSubscription) {
      this.notificationsSubscription.unsubscribe();
    }
    if (this.unreadCountSubscription) {
      this.unreadCountSubscription.unsubscribe();
    }
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  get filteredNotifications(): Notification[] {
    if (this.selectedFilter === 'unread') {
      return this.notifications.filter(n => !n.isRead);
    }
    return this.notifications;
  }

  async markAllAsRead(): Promise<void> {
    try {
      await this.notificationService.markAllAsRead();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    try {
      await this.notificationService.markAsRead(notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  async onNotificationClick(notification: Notification): Promise<void> {
    // Mark as read if unread
    if (!notification.isRead) {
      await this.markAsRead(notification.id);
    }
    
    // Navigate based on notification type
    this.navigateFromNotification(notification);
  }

  private navigateFromNotification(notification: Notification): void {
    switch (notification.type) {
      case 'like':
      case 'comment':
        if (notification.data?.storyId) {
          this.router.navigate(['/story', notification.data.storyId]);
        }
        break;
      case 'follow':
        if (notification.data?.fromUserId) {
          this.router.navigate(['/profile', notification.data.fromUserId]);
        }
        break;
      case 'story_published':
        if (notification.data?.storyId) {
          this.router.navigate(['/story', notification.data.storyId]);
        } else {
          this.router.navigate(['/my-stories']);
        }
        break;
      default:
        break;
    }
  }

  setFilter(filter: 'all' | 'unread'): void {
    this.selectedFilter = filter;
  }

  getTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks}w ago`;
    }
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths}mo ago`;
    }
    
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears}y ago`;
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'like': return '❤️';
      case 'comment': return '💬';
      case 'follow': return '👤';
      case 'story_published': return '✅';
      default: return '🔔';
    }
  }

  goBack(): void {
    window.history.back();
  }

  // TrackBy function for better performance
  trackByNotificationId(index: number, notification: Notification): string {
    return notification.id;
  }
}