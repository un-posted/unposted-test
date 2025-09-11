import { Routes } from '@angular/router';
import { Stories } from './components/stories/stories';
import { Profile } from './components/profile/profile';
import { About } from './components/about/about';
import { Login } from './components/login/login';
import { Register } from './components/register/register';
import { Story } from './components/story/story';
import { Write } from './components/write/write';
import { Notifications } from './components/notifications/notifications';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  { path: '', component: Stories, title: 'Stories - Unposted' },
  { path: 'stories', component: Stories, title: 'Stories - Unposted' },

  { path: 'story/:id', component: Story, title: 'Story - Unposted' },
  { path: 'story', component: Story, title: 'Story - Unposted' },
  { path: 'article', redirectTo: '/stories', pathMatch: 'full' },

  { path: 'about', component: About, title: 'About - Unposted' },

  // Auth-protected
  { path: 'notifications', component: Notifications, canActivate: [authGuard], title: 'Notifications - Unposted' },
  { path: 'write', component: Write, title: 'Write - Unposted' },
  { path: 'profile', component: Profile, canActivate: [authGuard], title: 'Profile - Unposted' },
  { path: 'profile/:id', component: Profile, canActivate: [authGuard], title: 'Profile - Unposted' },

  // Guest-only
  { path: 'login', component: Login, canActivate: [guestGuard], title: 'Login - Unposted' },
  { path: 'register', component: Register, canActivate: [guestGuard], title: 'Register - Unposted' },

  { path: '**', redirectTo: '/stories' }
];
