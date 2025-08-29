import { Routes } from '@angular/router';
import { StoriesComponent } from './shared/story/stories.component';
import { ArticleComponent } from './shared/story/article.component';
import { WriteStoryComponent } from './shared/story/write.component';
import { AboutComponent } from './shared/navbar/about.component';
import { LoginComponent } from './auth/login/login';
import { RegisterComponent } from './auth/register/register';
import { authGuard } from './core/guards/auth-guard';
import { ProfileComponent } from './shared/profile/profile.component';

export const routes: Routes = [
  { path: '', component: StoriesComponent },
  { path: 'stories', component: StoriesComponent },
  
  // Individual story routes
  { path: 'story/:id', component: ArticleComponent }, // Dynamic story by ID
  { path: 'article', redirectTo: '/stories', pathMatch: 'full' }, // Redirect old route
  
  // Other pages
  { path: 'about', component: AboutComponent },
  
  // Auth-protected routes
  { path: 'write', component: WriteStoryComponent },
  
  // Authentication routes
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  
  // User profile and management (if needed later)
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'profile/:id', component: ProfileComponent, canActivate: [authGuard] },
  // { path: 'my-stories', component: MyStoriesComponent, canActivate: [authGuard] },
  
  // Wildcard route - must be last
  { path: '**', redirectTo: '/stories' }
];