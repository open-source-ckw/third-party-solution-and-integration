import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import { Viewport } from './playwright.type';
import { ConfService } from '../../conf/conf.service';


@Injectable()
export class PlaywrightUaPool {
  private uas: string[] = [];
  private idx = 0;

  // common viewports (desktop + mobile)
  private viewports: Viewport[] = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, // iPhone-ish
    { width: 360, height: 800, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, // Android-ish
  ];

  private builtinUAs: string[] = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; SM-G996U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
  ];

  constructor(private readonly conf: ConfService) {
    this.load();
  }

  /** Load UAs from env: file:/..., inline:..., or a single raw UA string. */
  load() {
    const src = (this.conf.playwrightUaSource || '').trim();
    this.uas = [];

    if (src.startsWith('file:')) {
      const p = src.slice('file:'.length);
      if (fs.existsSync(p)) {
        this.uas = fs
          .readFileSync(p, 'utf8')
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('#'));
      }
    } else if (src.startsWith('inline:')) {
      // Use "||" as separator to avoid breaking on commas inside UA strings
      const list = src.slice('inline:'.length);
      this.uas = list
        .split('||')
        .map(s => s.trim())
        .filter(Boolean);
    } else if (src.length > 0) {
      // Treat as a single, explicit UA string (stick to this UA)
      this.uas = [src];
    }

    if (this.uas.length === 0) this.uas = this.builtinUAs;
  }

  /** Returns a UA string; rotation obeys PLAYWRIGHT_UA_ROTATE */
  pickUa(): string {
    if (!this.conf.playwrightUaRotate) {
      // stick with the first UA (could be your single inline/raw UA)
      return this.uas[0];
    }
    const ua = this.uas[this.idx % this.uas.length];
    this.idx++;
    return ua;
  }

  pickViewport(): Viewport | undefined {
    if (!this.conf.playwrightViewportRotate) return undefined;
    const i = Math.floor(Math.random() * this.viewports.length);
    return this.viewports[i];
  }
}