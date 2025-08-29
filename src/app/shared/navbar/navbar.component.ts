import { Component, EventEmitter, Input, OnInit, Output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth';
import { Subscription } from 'rxjs';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <!-- Desktop/Tablet Navbar -->
    <nav class="navbar desktop-navbar">
      <a class="navbar-logo" routerLink="/">
        <span>🌙</span>
        <span>Unposted</span>
      </a>
      
      <div class="navbar-right">        
        <div class="nav-links">
          <a routerLink="/stories" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Home</a>
          <a routerLink="/write" routerLinkActive="active">Write</a>
          <a routerLink="/about" routerLinkActive="active">About</a>
        </div>
        
        <!-- Authentication buttons when not logged in -->
        <div class="navbar-buttons" *ngIf="!user">
          <a routerLink="/login" class="auth-btn">Sign In</a>
          <a routerLink="/register" class="auth-btn signup">Sign Up</a>
        </div>

        <!-- User profile when logged in -->
        <div class="navbar-buttons logged-in" *ngIf="user">
          <div class="user-profile" (click)="toggleUserMenu()">
            <div class="user-avatar">
              {{ getUserInitial() }}
            </div>
            <span class="username">{{ getUserName() }}</span>
            <span class="dropdown-arrow" [class.rotated]="userMenuOpen">▼</span>
          </div>

          <!-- User dropdown menu -->
          <div class="user-menu" [class.active]="userMenuOpen">
            <div class="user-info">
              <div class="user-avatar-large">{{ getUserInitial() }}</div>
              <div>
                <div class="user-display-name">{{ getUserName() }}</div>
                <div class="user-email">{{ user.email }}</div>
              </div>
            </div>
            <hr>
            <a routerLink="/profile" (click)="closeUserMenu()">
              <span>👤</span> Profile
            </a>
            <a routerLink="/my-stories" (click)="closeUserMenu()">
              <span>📖</span> My Stories
            </a>
            <a routerLink="/settings" (click)="closeUserMenu()">
              <span>⚙️</span> Settings
            </a>
            <hr>
            <button class="logout-btn" (click)="logout()">
              <span>🚪</span> Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Mobile Bottom Navigation -->
    <nav class="bottom-nav mobile-navbar">
      <div class="bottom-nav-container">
        <!-- Home/Stories -->
        <a routerLink="/stories" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item">
          <div class="nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 22V12H15V22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="nav-label">Home</span>
        </a>

        <!-- Write -->
        <a routerLink="/write" routerLinkActive="active" class="nav-item">
          <div class="nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.49998C18.8978 2.10216 19.4374 1.87866 20 1.87866C20.5626 1.87866 21.1022 2.10216 21.5 2.49998C21.8978 2.89781 22.1213 3.43737 22.1213 3.99998C22.1213 4.56259 21.8978 5.10216 21.5 5.49998L12 15L8 16L9 12L18.5 2.49998Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="nav-label">Write</span>
        </a>

        <!-- About -->
        <a routerLink="/about" routerLinkActive="active" class="nav-item">
          <div class="nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52152 14.2151 8.06353C14.6713 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 17H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="nav-label">About</span>
        </a>

        <!-- Profile/Auth -->
        <div class="nav-item profile-nav" *ngIf="user; else authButtons">
          <div class="nav-icon profile-icon" (click)="toggleMobileUserMenu()">
            <div class="user-avatar-mobile">
              {{ getUserInitial() }}
            </div>
          </div>
          <span class="nav-label">Profile</span>
        </div>

        <ng-template #authButtons>
          <a routerLink="/login" class="nav-item auth-nav">
            <div class="nav-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10 17L15 12L10 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M15 12H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="nav-label">Sign In</span>
          </a>
        </ng-template>
      </div>
    </nav>

    <!-- Mobile User Menu Overlay -->
    <div class="mobile-user-overlay" [class.active]="mobileUserMenuOpen" *ngIf="user && mobileUserMenuOpen" (click)="closeMobileUserMenu()">
      <div class="mobile-user-menu" (click)="$event.stopPropagation()">
        <div class="mobile-user-header">
          <div class="user-avatar-large">{{ getUserInitial() }}</div>
          <div class="user-details">
            <div class="user-display-name">{{ getUserName() }}</div>
            <div class="user-email">{{ user.email }}</div>
          </div>
          <button class="close-mobile-menu" (click)="closeMobileUserMenu()">&times;</button>
        </div>
        
        <div class="mobile-menu-items">
          <a routerLink="/profile" (click)="closeMobileUserMenu()" class="mobile-menu-item">
            <span class="item-icon">👤</span>
            <span>Profile</span>
          </a>
          <a routerLink="/my-stories" (click)="closeMobileUserMenu()" class="mobile-menu-item">
            <span class="item-icon">📖</span>
            <span>My Stories</span>
          </a>
          <a routerLink="/settings" (click)="closeMobileUserMenu()" class="mobile-menu-item">
            <span class="item-icon">⚙️</span>
            <span>Settings</span>
          </a>
          <button class="mobile-menu-item logout-item" (click)="logout()">
            <span class="item-icon">🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Modal remains the same -->
    <div 
      class="modal" 
      [style.display]="isOpen ? 'flex' : 'none'"
      [attr.aria-hidden]="!isOpen"
      role="dialog"
      aria-labelledby="modal-title"
      aria-modal="true"
      (click)="onOverlayClick($event)">
      
      <div class="modal-content" role="document">
        <button 
          class="close-modal" 
          (click)="closeModal()"
          aria-label="Close Subscription Form">
          &times;
        </button>
        
        <h2 id="modal-title">Subscribe to Our Newsletter</h2>
        
        <form (ngSubmit)="onSubmit()" #subscribeForm="ngForm" action="https://formsubmit.co/unposted.infos@gmail.com" method="POST" target="_blank">
          <label for="email-subscribe">
            Email Address <span class="required">*</span>
          </label>
          <input 
            type="email" 
            id="email-subscribe" 
            name="email" 
            [(ngModel)]="email"
            placeholder="Enter your email" 
            required />

          <input type="text" name="_honey" style="display:none" />
          <input type="hidden" name="_captcha" value="false" />
          <input type="hidden" name="_next" value="https://un-posted.github.io/unposted/pages/thank-you.html" />
          
          <button type="submit" [disabled]="!subscribeForm.valid">
            Subscribe
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    /* Desktop Navbar Styles */
    .desktop-navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      background: white;
      border-bottom: 1px solid #eee;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
      position: relative;
    }

    .navbar-logo {
      font-size: 1.5rem;
      font-weight: bold;
      color: black;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .navbar-right {
      display: flex;
      align-items: center;
      gap: 2rem;
      position: relative;
    }

    .nav-links {
      display: flex;
      gap: 2rem;
      font-size: 0.95rem;
    }

    .nav-links a {
      text-decoration: none;
      color: var(--text-dark);
      transition: all 0.3s ease;
      padding: 0.5rem 0;
      
      &:hover, &.active {
        color: var(--main-color);
      }
      
      &.active {
        font-weight: 600;
      }
    }

    .navbar-buttons {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .navbar-buttons.logged-in {
      position: relative;
    }

    .auth-btn {
      text-decoration: none;
      color: var(--text-dark);
      padding: 0.6rem 1rem;
      border-radius: 6px;
      font-weight: 500;
      transition: all 0.3s ease;
      font-size: 0.9rem;
      
      &:hover {
        background: #f5f5f5;
      }
      
      &.signup {
        background: var(--main-color);
        color: var(--text-dark);
        font-weight: 600;
        
        &:hover {
          background: #f7a600;
        }
      }
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 8px;
      transition: background 0.3s ease;
      
      &:hover {
        background: #f5f5f5;
      }
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--main-color);
      color: var(--text-dark);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 0.9rem;
    }

    .user-avatar-large {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--main-color);
      color: var(--text-dark);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 1.1rem;
    }

    .username {
      font-weight: 500;
      color: var(--text-dark);
      font-size: 0.9rem;
    }

    .dropdown-arrow {
      font-size: 0.7rem;
      color: #666;
      transition: transform 0.3s ease;
      
      &.rotated {
        transform: rotate(180deg);
      }
    }

    .user-menu {
      position: absolute;
      top: 100%;
      right: 0;
      background: white;
      border: 1px solid #eee;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      min-width: 220px;
      transform: translateY(-10px);
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      z-index: 1000;
      margin-top: 0.5rem;

      &.active {
        transform: translateY(0);
        opacity: 1;
        visibility: visible;
      }
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 1rem;
    }

    .user-display-name {
      font-weight: 600;
      color: var(--text-dark);
      font-size: 0.9rem;
    }

    .user-email {
      color: #666;
      font-size: 0.8rem;
    }

    .user-menu hr {
      margin: 0;
      border: none;
      border-top: 1px solid #eee;
    }

    .user-menu a, .user-menu button {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.8rem 1rem;
      text-decoration: none;
      color: var(--text-dark);
      font-size: 0.9rem;
      transition: background 0.3s ease;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      cursor: pointer;
      
      &:hover {
        background: #f5f5f5;
      }
    }

    .logout-btn {
      color: #dc3545 !important;
      
      &:hover {
        background: #fff5f5 !important;
      }
    }

    /* Mobile Bottom Navigation */
    .mobile-navbar {
      display: none;
    }

    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      z-index: 1000;
      box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.1);
    }

    .bottom-nav-container {
      display: flex;
      justify-content: space-around;
      align-items: center;
      padding: 0.5rem 1rem 1rem;
      max-width: 100%;
    }

    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      padding: 0.5rem;
      border-radius: 12px;
      text-decoration: none;
      color: #666;
      transition: all 0.3s ease;
      min-width: 60px;
      position: relative;
      
      &:hover, &.active {
        color: var(--main-color);
        background: rgba(255, 193, 0, 0.1);
      }
      
      &.active {
        transform: translateY(-2px);
        
        .nav-icon {
          transform: scale(1.1);
        }
      }
    }

    .nav-icon {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease;
      
      svg {
        width: 100%;
        height: 100%;
      }
    }

    .nav-label {
      font-size: 0.7rem;
      font-weight: 500;
      text-align: center;
    }

    .profile-icon {
      cursor: pointer;
    }

    .user-avatar-mobile {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--main-color);
      color: var(--text-dark);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 0.7rem;
    }

    /* Mobile User Menu Overlay */
    .mobile-user-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: flex-end;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      
      &.active {
        opacity: 1;
        visibility: visible;
      }
    }

    .mobile-user-menu {
      width: 100%;
      background: white;
      border-radius: 20px 20px 0 0;
      max-height: 70vh;
      transform: translateY(100%);
      transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      
      .mobile-user-overlay.active & {
        transform: translateY(0);
      }
    }

    .mobile-user-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.5rem 1.5rem 1rem;
      border-bottom: 1px solid #eee;
      position: relative;
    }

    .user-details {
      flex: 1;
    }

    .close-mobile-menu {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: none;
      border: none;
      font-size: 1.5rem;
      color: #666;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 50%;
      transition: background 0.3s ease;
      
      &:hover {
        background: #f5f5f5;
      }
    }

    .mobile-menu-items {
      padding: 1rem 0;
    }

    .mobile-menu-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.5rem;
      text-decoration: none;
      color: var(--text-dark);
      font-size: 1rem;
      transition: background 0.3s ease;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      cursor: pointer;
      
      &:hover {
        background: #f5f5f5;
      }
      
      &.logout-item {
        color: #dc3545;
        
        &:hover {
          background: #fff5f5;
        }
      }
    }

    .item-icon {
      font-size: 1.2rem;
      width: 24px;
      text-align: center;
    }

    /* Modal styles remain the same */
    .modal {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .modal-content {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      max-width: 400px;
      width: 90%;
      position: relative;
      box-shadow: var(--card-shadow);
    }

    .close-modal {
      position: absolute;
      top: 0.5rem;
      right: 1rem;
      background: transparent;
      border: none;
      font-size: 2rem;
      line-height: 1;
      color: var(--main-color);
      cursor: pointer;
      font-weight: 700;
      transition: color 0.3s ease;

      &:hover {
        color: #f7a600;
      }
    }

    h2 {
      color: var(--main-color);
      margin-bottom: 1rem;
    }

    label {
      font-weight: 600;
      display: block;
      margin-bottom: 0.5rem;
    }

    .required {
      color: red;
    }

    input {
      padding: 0.7rem 1rem;
      border-radius: 8px;
      border: 1.5px solid #ccc;
      font-size: 1rem;
      width: 100%;
      margin-bottom: 1rem;
      
      &:focus {
        outline: none;
        border-color: var(--main-color);
      }
    }

    button[type="submit"] {
      background: var(--main-color);
      color: var(--text-dark);
      padding: 0.8rem 1.5rem;
      font-weight: 700;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      width: 100%;
      transition: background-color 0.3s ease;
      
      &:hover:not(:disabled) {
        background: #f7a600;
      }
      
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .desktop-navbar {
        display: none;
      }

      .mobile-navbar {
        display: block;
      }

      /* Add bottom padding to body to account for bottom nav */
      body {
        padding-bottom: 80px;
      }
    }

    @media (max-width: 480px) {
      .nav-label {
        font-size: 0.65rem;
      }
      
      .bottom-nav-container {
        padding: 0.4rem 0.5rem 0.8rem;
      }
    }

    /* Safe area for devices with home indicator */
    @supports (padding-bottom: env(safe-area-inset-bottom)) {
      .bottom-nav {
        padding-bottom: env(safe-area-inset-bottom);
      }
    }
  `]
})
export class NavbarComponent implements OnInit, OnDestroy {
  userMenuOpen = false;
  mobileUserMenuOpen = false;
  showAnnouncement = true;
  user: User | null = null;
  private userSubscription?: Subscription;
  
  @Input() isOpen = false;
  @Output() closeModalEvent = new EventEmitter<void>();
  @Output() subscribeEvent = new EventEmitter<string>();

  constructor(private authService: AuthService) {}

  ngOnInit() {
    // Subscribe to user authentication state
    this.userSubscription = this.authService.user$.subscribe(user => {
      this.user = user;
      console.log('User state changed:', user);
    });

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
    
    // Try to get from display name first
    if (this.user.displayName) {
      return this.user.displayName.charAt(0).toUpperCase();
    }
    
    // Fallback to email
    if (this.user.email) {
      return this.user.email.charAt(0).toUpperCase();
    }
    
    return 'U';
  }

  getUserName(): string {
    if (!this.user) return 'User';
    
    // Try display name first
    if (this.user.displayName) {
      return this.user.displayName;
    }
    
    // Fallback to email username
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
      console.log('Logout successful');
      // Optionally redirect to home page
      // this.router.navigate(['/']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  openSubscribeModal(event: Event) {
    event.preventDefault();
    this.isOpen = true;
    console.log('Open subscribe modal');
  }

  email = '';

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
}