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
    <!--<div class="announcement-bar" *ngIf="showAnnouncement">
      <span>Never miss the latest stories from Unposted.</span>
      <a href="#" (click)="openSubscribeModal($event)" class="announcement-link">
        Subscribe now →
      </a>
    </div>-->

    <nav class="navbar">
      <a class="navbar-logo" routerLink="/">
        <span>🌙</span>
        <span>Unposted</span>
      </a>
      
      <div class="navbar-right">
        <button 
          class="mobile-menu-toggle" 
          [class.active]="mobileMenuOpen"
          (click)="toggleMobileMenu()"
          aria-label="Toggle menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
        
        <div class="nav-links" [class.active]="mobileMenuOpen">
          <a routerLink="/stories" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Home</a>
          <!--<a routerLink="/stories" routerLinkActive="active">Stories</a>-->
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

          <!-- Anti-spam honeypot -->
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
    .navbar {
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

    .mobile-menu-toggle {
      display: none;
      flex-direction: column;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
      gap: 0.3rem;
      
      span {
        width: 20px;
        height: 2px;
        background: var(--text-dark);
        transition: all 0.3s ease;
        border-radius: 2px;
      }
      
      &.active {
        span:nth-child(1) {
          transform: rotate(45deg) translate(5px, 5px);
        }
        span:nth-child(2) {
          opacity: 0;
        }
        span:nth-child(3) {
          transform: rotate(-45deg) translate(7px, -6px);
        }
      }
    }

    .announcement-bar {
      background: #8B5CF6;
      color: #fff;
      font-size: 0.95rem;
      text-align: center;
      padding: 0.6rem 1rem;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .announcement-link {
      color: #fff;
      font-weight: 600;
      text-decoration: underline;
      transition: color 0.3s ease;
      
      &:hover {
        color: #FFF200;
      }
    }

    @media (max-width: 768px) {
      .navbar {
        padding: 1rem;
      }

      .navbar-logo {
        font-size: 1.2rem;
      }

      .navbar-right {
        gap: 1rem;
      }

      .mobile-menu-toggle {
        display: flex;
      }

      .nav-links {
        position: absolute;
        top: 100%;
        right: 0;
        background: white;
        border: 1px solid #eee;
        border-radius: 8px;
        box-shadow: var(--card-shadow-hover);
        flex-direction: column;
        gap: 0;
        padding: 1rem;
        min-width: 150px;
        transform: translateY(-10px);
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        z-index: 1000;

        &.active {
          transform: translateY(0);
          opacity: 1;
          visibility: visible;
        }

        a {
          padding: 0.7rem 0;
          font-size: 0.95rem;
        }
      }

      .username {
        display: none;
      }

      .navbar-buttons .cta-btn,
      .navbar-buttons .auth-btn {
        padding: 0.5rem 0.8rem;
        font-size: 0.8rem;
      }

      .user-menu {
        right: -1rem;
        min-width: 200px;
      }
    }

    @media (max-width: 480px) {
      .navbar-buttons {
        gap: 0.5rem;
      }
      
      .navbar-buttons .cta-btn,
      .navbar-buttons .auth-btn {
        padding: 0.4rem 0.6rem;
        font-size: 0.75rem;
      }

      .dropdown-arrow {
        display: none;
      }
    }

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
  `]
})
export class NavbarComponent implements OnInit, OnDestroy {
  mobileMenuOpen = false;
  userMenuOpen = false;
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
      if (!target?.closest('.navbar-right')) {
        this.mobileMenuOpen = false;
        this.userMenuOpen = false;
      }
    });
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    this.userMenuOpen = false; // Close user menu when opening mobile menu
  }

  toggleUserMenu() {
    this.userMenuOpen = !this.userMenuOpen;
    this.mobileMenuOpen = false; // Close mobile menu when opening user menu
  }

  closeUserMenu() {
    this.userMenuOpen = false;
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