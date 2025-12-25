import { Injectable } from '@nestjs/common';
import { PlaywrightService } from './playwright/playwright.service';
import { WithPageOpts } from './playwright/playwright.type';
import { BrowserContext, Page } from 'playwright';
import { HumanConfig, PlaywrightHuman } from './playwright/playwright.human';
@Injectable()
export class WebCrawlerService {
  constructor(
    private readonly playwright: PlaywrightService
) {}

  async checkConnection() {
    return this.playwright.checkConnection();
  }

  /**
   *run a job with a Human behaviour (non-persistent context).
   */
  public async withHumanPage<T>(
    fn: (page: Page, ctx: BrowserContext, H: PlaywrightHuman) => Promise<T>,
    opts?: WithPageOpts,
    humanCfg?: HumanConfig,
  ): Promise<T>{
    return this.playwright.withHumanPage(fn, opts, humanCfg);
  }
  /**
   * run a job with a Human behaviour bound to a persistent session profile.
   * Cookies/localStorage persist as per env variable
   */
async withHumanPagePersistent<T>(
  sessionId: string,
  fn: (page: Page, ctx: BrowserContext, H: PlaywrightHuman) => Promise<T>,
  opts?: WithPageOpts,
  humanCfg?: HumanConfig,
  keepAliveMs?: number,
): Promise<T> {
  return this.playwright.withHumanPagePersistent(sessionId, fn, opts, humanCfg, keepAliveMs);
}
  /**
   * Main entrypoint for scrapers — internally uses Playwright.
   * non-persistent one-off usage
   */
  async withPage<T>(
    fn: (page: any, ctx: any) => Promise<T>,
    opts?: WithPageOpts,
  ): Promise<T> {
    return this.playwright.withPage(fn, opts);
  }

  /**
   * Run with a persistent user profile bound to sessionId.
   * Cookies/localStorage/etc. are kept under PLAYWRIGHT_PERSISTENT_DIR/<sessionId>.
   *
   * @param sessionId               Stable id for the session (e.g., leadId/userId/jobId)
   * @param fn                      Your scraping logic
   * @param opts                    Regular WithPageOpts (url/label/etc.)
   * @param keepAliveMs             Optional idle timeout; auto-closes & deletes the profile after inactivity
   */
  async withPagePersistent<T>(
    sessionId: string,
    fn: (page: any, ctx: any) => Promise<T>,
    opts?: WithPageOpts,
    keepAliveMs?: number,
  ): Promise<T> {
    const merged: WithPageOpts = {
      ...(opts || {}),
      persistentSessionId: sessionId,
      // prefer explicit opts value if the caller passed persistentKeepAliveMs there
      persistentKeepAliveMs: opts?.persistentKeepAliveMs ?? keepAliveMs,
    };
    return this.playwright.withPage(fn, merged);
  }

  /**
   * Manually close & delete a persistent profile for a sessionId.
   * Useful when you want to log out / reset cookies / free disk.
   * There is no session in non-persistent mode.
   */
  async cleanupPersistentSession(sessionId: string): Promise<void> {
    await this.playwright.cleanupPersistent(sessionId);
  }

  /**
   * Example high-level helper: just fetch <title> from a URL.
   */
  async fetchTitle(url: string) {
    return this.withPage(async (page) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      return page.title();
    }, { url, label: 'fetch-title' });
  }
  /**
   * Example helper using persistent session (optional, for convenience)
   */
  async fetchTitlePersistent(url: string, sessionId: string) {
    return this.withPagePersistent(sessionId, async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      return page.title();
    }, { url, label: 'fetch-title' });
  }
}
