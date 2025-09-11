import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { User } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { Notification } from '../../models';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class Navbar implements OnInit, OnDestroy {
  userMenuOpen = false;
  mobileUserMenuOpen = false;
  showAnnouncement = true;
  user: User | null = null;
  
  // Notification properties
  notificationsOpen: boolean = false;
  notificationsMOpen: boolean = false;
  notifications: Notification[] = [];
  unreadCount: number = 0;
  
  private userSubscription?: Subscription;
  private notificationsSubscription?: Subscription;
  private unreadCountSubscription?: Subscription;
  
  @Input() isOpen = false;
  @Output() closeModalEvent = new EventEmitter<void>();
  @Output() subscribeEvent = new EventEmitter<string>();

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit() {
    // Subscribe to user authentication state
    this.userSubscription = this.authService.user$.subscribe(user => {
      this.user = user;
    });

    // Subscribe to notifications
    this.notificationsSubscription = this.notificationService.notifications$.subscribe(
      notifications => {
        this.notifications = notifications;
      }
    );

    // Subscribe to unread count
    this.unreadCountSubscription = this.notificationService.unreadCount$.subscribe(
      count => {
        this.unreadCount = count;
      }
    );
    
    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target?.closest('.navbar-right') && 
          !target?.closest('.mobile-user-menu') && 
          !target?.closest('.profile-nav')) {
        this.userMenuOpen = false;
        this.mobileUserMenuOpen = false;
      }
    });
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.notificationsSubscription) {
      this.notificationsSubscription.unsubscribe();
    }
    if (this.unreadCountSubscription) {
      this.unreadCountSubscription.unsubscribe();
    }
  }

  toggleUserMenu() {
    this.userMenuOpen = !this.userMenuOpen;
  }

  closeUserMenu() {
    this.userMenuOpen = false;
  }

  toggleMobileUserMenu() {
    this.mobileUserMenuOpen = !this.mobileUserMenuOpen;
  }

  closeMobileUserMenu() {
    this.mobileUserMenuOpen = false;
  }

  getUserInitial(): string {
    if (!this.user) return 'U';
    
    if (this.user.displayName) {
      return this.user.displayName.charAt(0).toUpperCase();
    }
    
    if (this.user.email) {
      return this.user.email.charAt(0).toUpperCase();
    }
    
    return 'U';
  }

  getUserName(): string {
    if (!this.user) return 'User';
    
    if (this.user.displayName) {
      return this.user.displayName;
    }
    
    if (this.user.email) {
      return this.user.email.split('@')[0];
    }
    
    return 'User';
  }

  async logout() {
    try {
      await this.authService.logout();
      this.closeUserMenu();
      this.closeMobileUserMenu();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Modal methods
  email = '';

  openSubscribeModal(event: Event) {
    event.preventDefault();
    this.isOpen = true;
  }

  closeModal() {
    this.isOpen = false;
    this.closeModalEvent.emit();
  }

  onOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  onSubmit() {
    if (this.email) {
      this.subscribeEvent.emit(this.email);
      this.email = '';
      this.closeModal();
    }
  }

  // Notification methods
  toggleNotifications(): void {
    this.notificationsOpen = !this.notificationsOpen;
    
    // On mobile, navigate to notifications page instead of showing dropdown
    //if (window.innerWidth <= 768 && !this.notificationsOpen) {
      //this.router.navigate(['/notifications']);
      //return;
    //}
  }

  closeNotifications(): void {
    this.notificationsOpen = false;
  }


toggleNotificationsM(): void {
    this.notificationsOpen = !this.notificationsOpen;
    
    // On mobile, navigate to notifications page instead of showing dropdown
    //if (window.innerWidth <= 768 && !this.notificationsOpen) {
      //this.router.navigate(['/notifications']);
      //return;
    //}
  }

  closeNotificationsM(): void {
    this.notificationsOpen = false;
  }

  async markNotificationsAsRead(): Promise<void> {
    try {
      await this.notificationService.markAllAsRead();
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  }

  async onNotificationClick(notification: Notification): Promise<void> {
    // Mark as read if unread
    if (!notification.isRead) {
      try {
        await this.notificationService.markAsRead(notification.id);
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }
    
    // Navigate based on notification type
    this.navigateFromNotification(notification);
    this.closeNotifications();
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
        // Handle other notification types or default behavior
        break;
    }
  }

  // Listen for clicks outside notifications dropdown
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const notificationBell = document.querySelector('.notification-bell');
    const notificationDropdown = document.querySelector('.notification-dropdown');
    
    if (this.notificationsOpen && 
        !notificationBell?.contains(target) && 
        !notificationDropdown?.contains(target)) {
      this.closeNotifications();
    }
  }

  // Helper method for time display
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

  // Helper method to get notification badge count display
  getBadgeDisplay(): string {
    if (this.unreadCount === 0) return '';
    if (this.unreadCount > 99) return '99+';
    return this.unreadCount.toString();
  }

  // Helper method to check if notifications should show
  get hasUnreadNotifications(): boolean {
    return this.unreadCount > 0;
  }
}