import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer>
      <div class="container">
        <div class="brand">
          <h3>🌙 Unposted</h3>
          <p class="tagline">Where hidden words find their voice.</p>
        </div>

        <div class="links">
          <a href="https://instagram.com/unpostedtn" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
        </div>
      </div>

      <div class="bottom">
        <p>© 2025 Unposted. All rights reserved.</p>
      </div>
    </footer>
  `,
  styles: [`
    footer {
      background: #fff;
      border-top: 1px solid var(--border-light);
      padding: 2rem 1.5rem;
      color: var(--text-secondary);
      font-family: 'Inter', sans-serif;
    }

    .container {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1.5rem;
    }

    .brand h3 {
      font-size: 1.3rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .tagline {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-top: 0.3rem;
    }

    .links {
      display: flex;
      gap: 1.2rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .links a {
      text-decoration: none;
      color: var(--text-secondary);
      font-size: 0.9rem;
      transition: color 0.2s ease;
    }

    .links a:hover {
        color: var(--main-color);
      }

    .bottom {
      margin-top: 2rem;
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    @media (min-width: 768px) {
      .container {
        flex-direction: row;
        justify-content: space-between;
        text-align: left;
      }
    }
  `]
})
export class FooterComponent {}
