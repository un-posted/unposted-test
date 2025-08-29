import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="about">
      <div class="container">
        <h1 class="about-title">🌙 About Unposted</h1>

        <p class="about-text">
          <span class="highlight">Unposted</span> is your personal corner of the internet —
          a safe place for the words you've been keeping in drafts, notes, or your heart.  
          Nothing here needs to be perfect or polished — it's about
          <em>writing what you feel</em>, <em>sharing what matters</em>,
          and giving your unposted words a home.
        </p>

        <blockquote class="quote">
          "Some stories don’t need to be finished to be worth sharing."
        </blockquote>

        <p class="about-text">
          Whether it’s a thought, a poem, a half-written story, or a single sentence
          that carries meaning for you — it belongs here.  
          Unposted is about <span class="highlight">expression without pressure</span>.
        </p>

        <div class="signature">— The Unposted Team</div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      background: #fdfcf9;
      color: #2e2e2e;
      line-height: 1.75;
      font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .container {
      padding: 3rem 1.5rem;
      max-width: 850px;
      margin: auto;
    }

    .about-title {
      text-align: center;
      font-size: 2.5rem;
      margin-bottom: 2rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .about-text {
      font-size: 1.1rem;
      color: #444;
      margin-bottom: 1.8rem;
    }

    .highlight {
      color: var(--accent-color, #F7C843);
      font-weight: 600;
    }

    .quote {
      font-style: italic;
      color: #555;
      border-left: 4px solid var(--accent-color, #F7C843);
      background: rgba(247, 200, 67, 0.06);
      padding: 1.2rem 1.5rem;
      border-radius: 8px;
      margin: 2.5rem 0;
      font-size: 1.1rem;
    }

    .signature {
      margin-top: 2.5rem;
      text-align: right;
      font-style: italic;
      color: #666;
      font-size: 0.95rem;
    }

    @media (max-width: 768px) {
      .about-title { font-size: 2rem; }
      .about-text { font-size: 1rem; }
      .quote { font-size: 1rem; }
    }
  `]
})
export class AboutComponent {}
