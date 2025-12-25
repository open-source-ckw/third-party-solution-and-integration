import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, BrowserContext, Page, devices, Route, firefox, webkit, BrowserType, LaunchOptions } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { IpApiShape, PoolItem, ProxyRecord, WithPageOpts } from './playwright.type';
import { ConfService } from '../../conf/conf.service';
import { LogService } from '../../log/log.service';
import { PlaywrightProxyPool } from './playwright.proxy.pool';
import { PlaywrightUaPool } from './playwright.ua.pool';
import { PlaywrightHuman, HumanConfig } from './playwright.human';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';


@Injectable()
export class PlaywrightService implements OnModuleDestroy {
  private browser: Browser | null = null;
  private pool: PoolItem[] = [];
  
  private initialized = false;
  private _initInProgress = false;
  
  // keep track of what we launched (set this where you log launch info)
  private _lastLaunch?: { engine: string; exec: string | 'bundled' };

  // per-host concurrency/QPS tracking
  private perHostActive = new Map<string, number>();
  private perHostLastAt = new Map<string, number>();

  private persistent = new Map<string, { ctx: BrowserContext; userDataDir: string; lastUsedAt: number; timer?: NodeJS.Timeout }>();

  
  constructor(
    private readonly conf: ConfService,
    private readonly log: LogService,
    private readonly proxyPool: PlaywrightProxyPool,
    private readonly uaPool: PlaywrightUaPool,
    private readonly human: PlaywrightHuman,
  ) {}
  

    // ---------- small utils ----------
    private delay(ms: number) { return new Promise(res => setTimeout(res, ms)); }

    private safeHost(u: string): string {
        try { return new URL(u).host; } catch { return 'general'; }
    }

    private fileName(label: string, ext: 'zip'|'har'): string {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        return `${label}-${ts}.${ext}`;
    }

    private ensureDir(dir: string): string {
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    return dir;
    }

  // ---------- boot / pool ----------

  /** Launch browser based on PLAYWRIGHT_BROWSER env:
   * - "chromium" | "firefox" | "webkit" -> bundled engines
   * - absolute/relative path -> infer engine from filename and set executablePath
   */
  private async ensureBrowser(opts?: any): Promise<Browser> {
    if (!this.browser) {
      const headless = typeof opts?.headed === 'boolean' ? !opts.headed : this.conf.playwrightHeadless;
      const slowMo   = opts?.slowMoMs ?? this.conf.playwrightSlowmoMs ?? 0;
      const devtools = opts?.devtools ?? this.conf.playwrightDevtools ?? false;
  
      // figure out engine + path
      const spec = this.resolveBrowserSpec((this.conf as any).playwrightBrowser as string);
  
      const launchOpts: LaunchOptions = {
        headless,
        slowMo,
        devtools,
        downloadsPath: this.conf.downloadDirPath,
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--disable-infobars',
          //'--start-maximized',
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox', 
          '--disable-setuid-sandbox',
        ],
      };
      if (spec.executablePath) launchOpts.executablePath = spec.executablePath;
  
      this.browser = await spec.type.launch(launchOpts);
  
      // 🚨 explicit startup log
      this.log.info(
        {
          engine: spec.engineName,
          executablePath: spec.executablePath || 'bundled',
          headless,
          slowMo,
          devtools,
        },
        '✅ Playwright browser launched'
      );
      this._lastLaunch = { engine: spec.engineName, exec: spec.executablePath || 'bundled' };
    }
  
    if (!this.initialized) {
      this.initialized = true;   // break recursion
      await this.initPool();
    }
    return this.browser;
  }
  

  private async initPool() {
    if (this._initInProgress) {
      this.log.warn('initPool re-entry detected; skipping');
      return;
    }
    this._initInProgress = true;
    try {
      // DO NOT call ensureBrowser() here. Browser is guaranteed ready by ensureBrowser().
      const size = this.conf.playwrightPoolSize || 4;
      this.pool = [];
      for (let i = 0; i < size; i++) {
        const ctx = await this.createBaseContext();
        this.pool.push({ ctx, inUse: false, createdAt: Date.now(), jobsDone: 0 });
      }
      this.log.info({ poolSize: size }, 'Context pool initialized');
    } finally {
      this._initInProgress = false;
    }
  }

  /** base context for the pool (lightweight; no recording) */
  private async createBaseContext(label?: string): Promise<BrowserContext> {
    const br = this.browser!;
    const proxy = this.proxyPool.has() ? this.proxyPool.pick() : undefined;
    const userAgent = this.uaPool.pickUa();
    const viewport = this.uaPool.pickViewport();

    const ctx = await br.newContext({
      ...devices['Desktop Chrome'],
      ...(viewport || {}),
      userAgent,
      proxy: proxy ? { server: proxy.server, username: proxy.username, password: proxy.password } : undefined,
    });

    await this.applyBlocking(ctx, {
      blockMedia: this.conf.playwrightBlockMedia,
      blockAnalytics: this.conf.playwrightBlockAnalytics,
    });

    if (this.conf.playwrightStealth) {
      await this.applyStealthMinimal(ctx);
    }

    (ctx as any).__label = label;
    return ctx;
  }

  /** ephemeral context for trace/video/HAR (mirrors base context + extras) */
  private async createEphemeralContext(base?: { proxy?: ProxyRecord; userAgent?: string; viewport?: Record<string, any>; recordVideo?: boolean; harPath?: string }) {
    const br = this.browser!;
    const proxy = base?.proxy ?? (this.proxyPool.has() ? this.proxyPool.pick() : undefined);
    const userAgent = base?.userAgent ?? this.uaPool.pickUa();
    const viewport = base?.viewport ?? this.uaPool.pickViewport();

    const ctx = await br.newContext({
      ...devices['Desktop Chrome'],
      ...(viewport || {}),
      userAgent,
      proxy: proxy ? { server: proxy.server, username: proxy.username, password: proxy.password } : undefined,
      // @ts-ignore – available on recent Playwright
      recordHar: base?.harPath ? { path: base.harPath } : undefined,
      recordVideo: base?.recordVideo ? { dir: this.conf.playwrightVideoDirPath || '/assets/tmp/video' } : undefined,
    });

    await this.applyBlocking(ctx, {
      blockMedia: this.conf.playwrightBlockMedia,
      blockAnalytics: this.conf.playwrightBlockAnalytics,
    });

    if (this.conf.playwrightStealth) {
      await this.applyStealthMinimal(ctx);
    }

    return ctx;
  }

  private async applyBlocking(ctx: BrowserContext, opts: { blockMedia?: boolean; blockAnalytics?: boolean }) {
    if (!opts.blockMedia && !opts.blockAnalytics) return;
    await ctx.route('**/*', (route: Route) => {
      const req = route.request();
      const type = req.resourceType();
      const url = req.url();

      if (opts.blockMedia && (type === 'image' || type === 'font' || type === 'media')) {
        return route.abort();
      }
      if (opts.blockAnalytics && this.isAnalytics(url)) {
        return route.abort();
      }
      return route.continue();
    });
  }

  private isAnalytics(url: string) {
    return /google-analytics\.com|googletagmanager\.com|segment\.com|mixpanel\.com|hotjar\.com|fullstory\.com/i.test(url);
  }

  // ---------- acquire / release ----------

  private async acquireContext(domainLabel?: string): Promise<PoolItem> {
    while (true) {
      const i = this.pool.findIndex(p => !p.inUse && !this.isExpired(p));
      if (i >= 0) {
        const pi = this.pool[i];
        pi.inUse = true;
        return pi;
      }
      // recycle first expired free context
      const e = this.pool.findIndex(p => this.isExpired(p) && !p.inUse);
      if (e >= 0) {
        try { await this.pool[e].ctx.close(); } catch {}
        const newCtx = await this.createBaseContext(this.conf.playwrightSessionPerDomain ? domainLabel : undefined);
        this.pool[e] = { ctx: newCtx, inUse: true, createdAt: Date.now(), jobsDone: 0, label: this.conf.playwrightSessionPerDomain ? domainLabel : undefined };
        return this.pool[e];
      }
      await this.delay(25);
    }
  }

  private releaseContext(pi: PoolItem) {
    pi.jobsDone += 1;
    pi.inUse = false;
  }

  private isExpired(pi: PoolItem) {
    const ttl = this.conf.playwrightSessionTtlMs ?? 30 * 60_000;
    const maxJobs = this.conf.playwrightSessionMaxJobs ?? 50;
    const ageOk = Date.now() - pi.createdAt < ttl;
    const jobsOk = pi.jobsDone < maxJobs;
    return !(ageOk && jobsOk);
  }

  // ---------- per‑host throttling ----------

  private async acquireHostSlot(host: string) {
    const maxConc = this.conf.playwrightRateMaxConcurrencyPerHost ?? 2;
    const maxQps = this.conf.playwrightRateMaxQpsPerHost ?? 0.5;
    while ((this.perHostActive.get(host) ?? 0) >= maxConc) {
      await this.delay(20);
    }
    if (maxQps > 0) {
      const minGapMs = Math.ceil(1000 / maxQps);
      const last = this.perHostLastAt.get(host) ?? 0;
      const gap = Date.now() - last;
      if (gap < minGapMs) await this.delay(minGapMs - gap);
    }
    this.perHostActive.set(host, (this.perHostActive.get(host) ?? 0) + 1);
    this.perHostLastAt.set(host, Date.now());
  }

  private releaseHostSlot(host: string) {
    const n = (this.perHostActive.get(host) ?? 1) - 1;
    if (n <= 0) this.perHostActive.delete(host);
    else this.perHostActive.set(host, n);
  }

  // ---------- helpers ----------

  private shouldRetry(err: any): boolean {
    const msg = String(err ?? '').toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('deadline exceeded') ||
      msg.includes('net::err') ||
      msg.includes('navigation') ||
      msg.includes('target closed')
    );
  }

  /** Scrub PII from log payloads if enabled */
  private safeLog<T extends Record<string, any>>(obj: T): T {
    if (!this.conf.playwrightLogScrubPii) return obj;
    const scrub = (s: string) =>
      s.replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/g, '[redacted-email]')
       .replace(/\b(?:\+?\d{1,3}[-.\s]?)?(?:\d{3}[-.\s]?){2}\d{4}\b/g, '[redacted-phone]');
    const out: any = Array.isArray(obj) ? [] : {};
    for (const k in obj) {
      const v = (obj as any)[k];
      if (typeof v === 'string') out[k] = scrub(v);
      else if (v && typeof v === 'object') out[k] = this.safeLog(v);
      else out[k] = v;
    }
    return out;
  }

  private safeParseIp(raw?: string | null): string | null {
    if (!raw) return null;
    try {
      const j = JSON.parse(raw);
      // ipify: { ip: "x.x.x.x" }, httpbin: { origin: "x.x.x.x" or "x.x.x.x, y.y.y.y" }
      if (typeof j.ip === 'string') return j.ip.trim();
      if (typeof j.origin === 'string') return j.origin.split(',')[0].trim();
    } catch {
      // sometimes body is just the IP string
      const m = raw.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
      if (m) return m[0];
    }
    return null;
  }

  /** Decide BrowserType + executablePath from env value */
  private resolveBrowserSpec(envVal?: string | null): { type: BrowserType<Browser>, executablePath?: string, engineName: string } {
    const val = (envVal || '').trim();
  
    // default → bundled Chromium
    if (!val) {
      return { type: chromium, engineName: 'chromium (bundled)' };
    }
  
    const lc = val.toLowerCase();
  
    // explicit engine names
    if (lc === 'chromium') return { type: chromium, engineName: 'chromium (bundled)' };
    if (lc === 'firefox')  return { type: firefox,  engineName: 'firefox (bundled)'  };
    if (lc === 'webkit')   return { type: webkit,   engineName: 'webkit (bundled)'   };
  
    // treat as executable path
    const isPathLike = /[\\/]/.test(val) || /\.(exe|app)$/i.test(val) || val.startsWith('.');
    if (isPathLike) {
      const file = val.replace(/\\/g, '/');
      const base = file.split('/').pop()!.toLowerCase();
  
      // --- Firefox system binary ---
      if (base.includes('firefox')) {
        this.log.warn(
          { path: val },
          'Using system Firefox executable. Some Playwright features may not be available compared to the bundled Firefox build.'
        );
        return { type: firefox, executablePath: val, engineName: 'firefox (system exe)' };
      }
  
      // --- Chrome/Chromium/Edge system binary ---
      if (base.includes('chrome') || base.includes('chromium') || base.includes('edge') || base.includes('msedge')) {
        return { type: chromium, executablePath: val, engineName: 'chromium (system exe)' };
      }
  
      // --- Safari not supported ---
      if (base.includes('safari') || base.includes('webkit')) {
        this.log.warn(
          { path: val },
          'Safari executable is not supported by Playwright. Falling back to bundled WebKit.'
        );
        return { type: webkit, engineName: 'webkit (bundled)' };
      }
  
      // --- Unknown fallback ---
      this.log.warn(
        { path: val },
        'Unknown browser executable; defaulting to Chromium engine with this path'
      );
      return { type: chromium, executablePath: val, engineName: 'chromium (system exe?)' };
    }
  
    // fallback on typo: use bundled Chromium
    this.log.warn({ value: val }, 'Unrecognized PLAYWRIGHT_BROWSER value; defaulting to bundled Chromium');
    return { type: chromium, engineName: 'chromium (bundled)' };
  }

  private safeJson(raw?: string | null): any | null {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  
  private async tryGetIpViaJson(page: any): Promise<string | null> {
    try {
      await page.goto('https://api.ipify.org?format=json', { waitUntil: 'networkidle' });
      const raw = await page.locator('pre, body').first().textContent();
      const j = this.safeJson(raw);
      if (j?.ip) return String(j.ip).trim();
    } catch {}
    try {
      await page.goto('https://httpbin.org/ip', { waitUntil: 'networkidle' });
      const raw = await page.locator('pre, body').first().textContent();
      const j = this.safeJson(raw);
      if (typeof j?.origin === 'string') return j.origin.split(',')[0].trim();
    } catch {}
    return null;
  }
  
  private coerceIpApiShape(j: any): IpApiShape {
    // ipapi.co already uses the desired fields; coerce & normalize
    return this.fillIpApiDefaults({
      ip: j.ip ?? null,
      network: j.network ?? null,
      version: j.version ?? null,
      city: j.city ?? null,
      region: j.region ?? null,
      region_code: j.region_code ?? null,
      country: j.country ?? j.country_code ?? null,
      country_name: j.country_name ?? null,
      country_code: j.country_code ?? null,
      country_code_iso3: j.country_code_iso3 ?? null,
      country_capital: j.country_capital ?? null,
      country_tld: j.country_tld ?? null,
      continent_code: j.continent_code ?? null,
      in_eu: typeof j.in_eu === 'boolean' ? j.in_eu : null,
      postal: j.postal ?? null,
      latitude: this.numOrNull(j.latitude),
      longitude: this.numOrNull(j.longitude),
      timezone: j.timezone ?? null,
      utc_offset: j.utc_offset ?? null,
      country_calling_code: j.country_calling_code ?? null,
      currency: j.currency ?? null,
      currency_name: j.currency_name ?? null,
      languages: j.languages ?? null,
      country_area: this.numOrNull(j.country_area),
      country_population: this.numOrNull(j.country_population),
      asn: j.asn ?? null,
      org: j.org ?? null,
    });
  }
  
  private mapIpwhoisToIpapi(j: any): IpApiShape {
    return this.fillIpApiDefaults({
      ip: j.ip ?? null,
      network: j.connection?.isp ?? null,
      version: j.type ?? null,
      city: j.city ?? null,
      region: j.region ?? null,
      region_code: j.region_code ?? null,
      country: j.country_code ?? null,
      country_name: j.country ?? null,
      country_code: j.country_code ?? null,
      country_code_iso3: null,
      country_capital: null,
      country_tld: j.tld ?? null,
      continent_code: j.continent_code ?? null,
      in_eu: null,
      postal: j.postal ?? null,
      latitude: this.numOrNull(j.latitude ?? j.lat),
      longitude: this.numOrNull(j.longitude ?? j.lon),
      timezone: j.timezone ?? null,
      utc_offset: null,
      country_calling_code: j.calling_code ?? null,
      currency: j.currency ?? null,
      currency_name: j.currency_name ?? null,
      languages: Array.isArray(j.languages) ? j.languages.join(',') : (j.languages ?? null),
      country_area: this.numOrNull(j.country_area),
      country_population: this.numOrNull(j.country_population),
      asn: j.connection?.asn ?? null,
      org: j.connection?.org ?? j.org ?? null,
    });
  }
  
  private mapIpinfoToIpapi(j: any): IpApiShape {
    // ipinfo fields: ip, hostname, city, region, country, loc, org, postal, timezone
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (typeof j.loc === 'string' && j.loc.includes(',')) {
      const [lat, lon] = j.loc.split(',');
      latitude = this.numOrNull(lat);
      longitude = this.numOrNull(lon);
    }
    return this.fillIpApiDefaults({
      ip: j.ip ?? null,
      network: j.org ?? null,
      version: null,
      city: j.city ?? null,
      region: j.region ?? null,
      region_code: null,
      country: j.country ?? null,
      country_name: null,
      country_code: j.country ?? null,
      country_code_iso3: null,
      country_capital: null,
      country_tld: null,
      continent_code: null,
      in_eu: null,
      postal: j.postal ?? null,
      latitude,
      longitude,
      timezone: j.timezone ?? null,
      utc_offset: null,
      country_calling_code: null,
      currency: null,
      currency_name: null,
      languages: null,
      country_area: null,
      country_population: null,
      asn: (typeof j.org === 'string' && j.org.startsWith('AS')) ? j.org.split(' ')[0] : null,
      org: j.org ?? null,
    });
  }
  
  private async scrapeWhatIsMyIpAddress(page: any, ip: string): Promise<Partial<IpApiShape> | null> {
    try {
      await page.goto(`https://whatismyipaddress.com/ip/${encodeURIComponent(ip)}`, { waitUntil: 'domcontentloaded' });
      const html = await page.content();
      const pick = (rx: RegExp) => {
        const m = html.match(rx);
        return m ? m[m.length - 1].replace(/<\/?[^>]+>/g, '').trim() : null;
      };
      const city = pick(/\bCity:\s*<\/?[^>]*>\s*([^<\n]+)/i);
      const region = pick(/\b(Region|State|Province):\s*<\/?[^>]*>\s*([^<\n]+)/i);
      const country_name = pick(/\bCountry:\s*<\/?[^>]*>\s*([^<\n]+)/i);
      const asn = pick(/\bASN:\s*<\/?[^>]*>\s*([^<\n]+)/i);
      const org = pick(/\bOrganization:\s*<\/?[^>]*>\s*([^<\n]+)/i) || pick(/\bISP:\s*<\/?[^>]*>\s*([^<\n]+)/i);
  
      return {
        city: city || null,
        region: region || null,
        country_name: country_name || null,
        asn: asn || null,
        org: org || null,
      };
    } catch {
      return null;
    }
  }
  
  private numOrNull(v: any): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  
  private fillIpApiDefaults(partial: Partial<IpApiShape>): IpApiShape {
    const base: IpApiShape = {
      ip: null, network: null, version: null, city: null, region: null, region_code: null,
      country: null, country_name: null, country_code: null, country_code_iso3: null,
      country_capital: null, country_tld: null, continent_code: null, in_eu: null, postal: null,
      latitude: null, longitude: null, timezone: null, utc_offset: null, country_calling_code: null,
      currency: null, currency_name: null, languages: null, country_area: null, country_population: null,
      asn: null, org: null,
    };
    return { ...base, ...partial };
  }

  /** Minimal stealth: webdriver off, chrome.runtime stub, languages + Accept-Language */
private async applyStealthMinimal(ctx: BrowserContext) {
  // 1) JS-side signals
  const languages = this.conf.playwrightStealthLang;
  await ctx.addInitScript(({ languages }) => {
    // navigator.webdriver -> undefined
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // window.chrome.runtime stub
    // @ts-ignore
    window.chrome = window.chrome || {};
    // @ts-ignore
    window.chrome.runtime = window.chrome.runtime || {};

    // navigator.languages aligned to config
    Object.defineProperty(navigator, 'languages', { get: () => languages });
  }, { languages });

  // 2) Network header (context-level)
  const acceptLanguage = this.conf.playwrightStealthAcceptLanguage;
  // This replaces headers for this context; you’re not setting other headers elsewhere, so it’s safe.
  await ctx.setExtraHTTPHeaders({
    'Accept-Language': acceptLanguage,
  });
}
  // ---------- persistent session based context API ----------
  private sessionDir(sessionId: string): string {
    const base = this.conf.playwrightPersistentDirPath || '/assets/tmp/persistent';
    this.ensureDir(base);
    return path.join(base, sessionId);
  }
  private scheduleAutoClose(sessionId: string, ms: number) {
    return setTimeout(() => {
      this.closePersistent(sessionId).catch(() => {});
    }, ms);
  }
  /** Manually close and delete a persistent profile */
public async cleanupPersistent(sessionId: string) {
  const entry = this.persistent.get(sessionId);
  if (!entry) return;
  try { await entry.ctx.close(); } catch {}
  this.persistent.delete(sessionId);
  try { fs.rmSync(entry.userDataDir, { recursive: true, force: true }); } catch {}
}
/** Close a persistent context but KEEP its profile directory for reuse */
public async closePersistent(sessionId: string) {
  const entry = this.persistent.get(sessionId);
  if (!entry) return;
  try { await entry.ctx.close(); } catch {}
  this.persistent.delete(sessionId);
}
/** Decide persistent engine/channel from env (Chrome/Edge use channel; Firefox/Chromium bundled) */
private resolvePersistentSpec(envVal?: string | null): { type: BrowserType<Browser>, channel?: 'chrome' | 'msedge', engineName: string } {
  const val = (envVal || '').trim().toLowerCase();
  if (!val) return { type: chromium, engineName: 'chromium (bundled, persistent)' };
  const base = val.split(/[\\/]/).pop() || val;
  if (base.includes('msedge') || base.includes('edge')) {
    return { type: chromium, channel: 'msedge', engineName: 'edge (channel, persistent)' };
  }
  if (base.includes('chrome') || base.includes('chromium')) {
    return { type: chromium, channel: 'chrome', engineName: 'chrome (channel, persistent)' };
  }
  if (base.includes('firefox')) {
    return { type: firefox, engineName: 'firefox (persistent)' };
  }
  return { type: chromium, engineName: 'chromium (bundled, persistent)' };
}

/** Create or reuse a persistent context honoring PLAYWRIGHT_BROWSER (channel-based) */
private async acquirePersistentContext(sessionId: string, opts?: WithPageOpts): Promise<BrowserContext> {
  const host = opts?.url ? this.safeHost(opts.url) : 'general';
  const existing = this.persistent.get(sessionId);
  if (existing) {
    existing.lastUsedAt = Date.now();
    if (existing.timer && opts?.persistentKeepAliveMs) {
      clearTimeout(existing.timer);
      existing.timer = this.scheduleAutoClose(sessionId, opts.persistentKeepAliveMs);
    }
    return existing.ctx;
  }

  //const spec = this.resolvePersistentSpec((this.conf as any).playwrightBrowser as string);
  const spec = this.resolveBrowserSpec((this.conf as any).playwrightBrowser as string);

  // Same UA/viewport/proxy strategy as pooled contexts
  const proxyRec = this.proxyPool.has() ? this.proxyPool.pick() : undefined;
  const userAgent = this.uaPool.pickUa();
  const viewport  = this.uaPool.pickViewport();
  const headless  = typeof opts?.headed === 'boolean' ? !opts.headed : this.conf.playwrightHeadless;
  const slowMo   = opts?.slowMoMs ?? this.conf.playwrightSlowmoMs ?? 0;
  const devtools = opts?.devtools ?? this.conf.playwrightDevtools ?? false;
  const userDataDir = this.sessionDir(sessionId);

  const launchOpts: any = {
    headless,
    //ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-infobars',
      //'--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    userAgent,
    viewport: viewport || undefined,
    proxy: proxyRec ? { server: proxyRec.server, username: proxyRec.username, password: proxyRec.password } : undefined,
    javaScriptEnabled: true,
    devtools: devtools,
    slowMo: slowMo,
    downloadsPath: this.conf.downloadDirPath,
    executablePath: spec.executablePath,
  };
  //if (spec.channel) launchOpts.channel = spec.channel;

  const ctx = await spec.type.launchPersistentContext(userDataDir, launchOpts);
  this.log.info(this.safeLog({ engine: spec.engineName, userDataDir, channel: spec.executablePath || null }), '✅ Persistent context launched');

  // Apply blockers using your env-backed flags
  await this.applyBlocking(ctx, {
    blockMedia: this.conf.playwrightBlockMedia,
    blockAnalytics: this.conf.playwrightBlockAnalytics,
  });

  if (this.conf.playwrightStealth) {
    await this.applyStealthMinimal(ctx);
  }

  const entry = {
    ctx,
    userDataDir,
    lastUsedAt: Date.now(),
    timer: opts?.persistentKeepAliveMs ? this.scheduleAutoClose(sessionId, opts.persistentKeepAliveMs) : undefined,
  };
  this.persistent.set(sessionId, entry);
  return ctx;
}

  // ---------- public API ----------

  
  public async onModuleDestroy() {
    /*
    // close persistent contexts and delete their profiles
    for (const id of Array.from(this.persistent.keys())) {
      await this.cleanupPersistent(id).catch(() => {});
    }
    // existing pool/browser cleanup
    for (const p of this.pool) await p.ctx.close().catch(() => {});
    if (this.browser) await this.browser.close().catch(() => {});
    this.log.info('Playwright closed');
    */
  }

  async withPage<T>(
    fn: (page: Page, ctx: BrowserContext) => Promise<T>,
    opts?: WithPageOpts,
  ): Promise<T> {
    // if persistent session id is given then enable this mode
    const usePersistent = !!opts?.persistentSessionId;

    if(!usePersistent){
      await this.ensureBrowser(opts);
    }
  
    const host = opts?.url ? this.safeHost(opts.url) : 'general';
    await this.acquireHostSlot(host);
  
    // per-call toggles
    const traceMode      = (opts?.trace ?? this.conf.playwrightTraceMode ?? 'off') as 'off'|'on'|'retain-on-failure';
    const recordVideo    = opts?.recordVideo ?? this.conf.playwrightVideoRecord ?? false;
    const blockMedia     = opts?.blockMedia ?? this.conf.playwrightBlockMedia ?? false;
    const blockAnalytics = opts?.blockAnalytics ?? this.conf.playwrightBlockAnalytics ?? false;
  
    const traceDir = this.ensureDir(this.conf.playwrightTraceDirPath || '/assets/tmp/trace');
    const videoDir = this.ensureDir(this.conf.playwrightVideoDirPath || '/assets/tmp/video');
    const harDir   = this.ensureDir(this.conf.playwrightHarDirPath   || '/assets/tmp/har');
  
    let pi: PoolItem | null = null;
    let workingCtx: BrowserContext;
    let madeTemp = false;
    const needsTempCtx = (traceMode !== 'off') || recordVideo || !!this.conf.playwrightHarDirPath;
    const harPath = this.conf.playwrightHarDir ? path.join(harDir, this.fileName(opts?.label ?? host, 'har')) : undefined;

    try {
      
  
      if (usePersistent) {
        // persistent profile path (userDataDir) per session id
        workingCtx = await this.acquirePersistentContext(opts!.persistentSessionId!, opts);
        if (needsTempCtx) {
          madeTemp = true;
          await this.applyBlocking(workingCtx, { blockMedia, blockAnalytics });
        }
      } else {
        // pooled path (unchanged)
        pi = await this.acquireContext(this.conf.playwrightSessionPerDomain ? host : undefined);
        if (needsTempCtx) {
          workingCtx = await this.createEphemeralContext({ recordVideo, harPath });
          madeTemp = true;
          await this.applyBlocking(workingCtx, { blockMedia, blockAnalytics });
        } else {
          workingCtx = pi.ctx;
        }
      }
  
      // tracing
      if (traceMode !== 'off') {
        await workingCtx.tracing.start({ screenshots: true, snapshots: true, title: opts?.label ?? host });
      }
  
      //const page = await workingCtx.newPage();
      const pages = workingCtx.pages();
      const page = pages.length ? pages[0] : await workingCtx.newPage();

      page.setDefaultTimeout(this.conf.scraperTimeoutMs ?? 30_000);
  
      if (opts?.pause) await page.pause();
  
      const attemptMax = this.conf.playwrightMaxRetries ?? 3;
      const backoff    = this.conf.playwrightBackoffMs ?? 5000;
  
      let lastErr: any = null;
  
      for (let i = 1; i <= attemptMax; i++) {
        try {
          const result = await fn(page, workingCtx);
  
          if (traceMode === 'on') {
            const tracePath = path.join(traceDir, this.fileName(opts?.label ?? host, 'zip'));
            await workingCtx.tracing.stop({ path: tracePath }).catch(() => {});
            this.log.info(this.safeLog({ tracePath }), 'Trace saved');
          } else if (traceMode !== 'off') {
            await workingCtx.tracing.stop().catch(() => {});
          }
          await page.close().catch(() => {});
          if (madeTemp) await workingCtx.close().catch(() => {});
          return result;
        } catch (err) {
          lastErr = err;
          const retry = i < attemptMax && this.shouldRetry(err);
          this.log.error(this.safeLog({ host, attempt: i, retry, err: String(err) }), 'withPage attempt failed');
          if (retry) await this.delay(backoff * i);
        }
      }
      throw lastErr;
    } catch (err) {
      if (traceMode === 'retain-on-failure') {
        const tracePath = path.join(traceDir, this.fileName((opts?.label ?? host) + '-fail', 'zip'));
        try { await workingCtx?.tracing.stop({ path: tracePath }); } catch {}
        this.log.error(this.safeLog({ tracePath }), 'Saved failure trace');
      } else if (traceMode !== 'off') {
        try { await workingCtx?.tracing.stop(); } catch {}
      }
      throw err;
    } finally {
      if (pi) this.releaseContext(pi);
      this.releaseHostSlot(host);
    }
  }
  public async withHumanPage<T>(
    fn: (page: Page, ctx: BrowserContext, H: PlaywrightHuman) => Promise<T>,
    opts?: WithPageOpts,
    humanCfg?: HumanConfig,
  ): Promise<T> {
    return this.withPage(async (page, ctx) => {
      const H = await this.human.createHuman(page, humanCfg);
      return fn(page, ctx, H);
    }, opts);
  }

  public async withHumanPagePersistent<T>(
    sessionId: string,
    fn: (page: Page, ctx: BrowserContext, H: PlaywrightHuman) => Promise<T>,
    opts?: WithPageOpts,
    humanCfg?: HumanConfig,
    keepAliveMs?: number,
  ): Promise<T> {
    const merged: WithPageOpts = {
      ...(opts || {}),
      persistentSessionId: sessionId,
      persistentKeepAliveMs: opts?.persistentKeepAliveMs ?? keepAliveMs,
    };
    return this.withPage(async (page, ctx) => {
      const H = await this.human.createHuman(page, humanCfg);
      return fn(page, ctx, H);
    }, merged);
  }
  
/**
 * Returns full geo/IP info using ipapi.co (preferred).
 * Falls back to other providers if needed.
 * The result includes your current userAgent, engine, and executable.
 */
public async checkConnection(): Promise<
{
  userAgent: string | null;
  engine: string;
  executable: string | 'bundled';
  source: string; // which provider returned the data
} & IpApiShape
> {
  await this.ensureBrowser({});

  return this.withPage(async (page) => {
    const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => null);

    // --- 1) Try ipapi.co WITHOUT knowing IP first (ipapi can infer from request) ---
    // This is ideal because it’s a single call through your proxy.
    let data: Partial<IpApiShape> | null = null;
    let source = '';

    try {
      await page.goto('https://ipapi.co/json/', { waitUntil: 'domcontentloaded' });
      const raw = await page.locator('pre, body').first().textContent();
      const parsed = this.safeJson(raw);
      if (parsed && parsed.ip) {
        data = this.coerceIpApiShape(parsed);
        source = 'ipapi.co/json';
      }
    } catch {}

    // --- 2) If that failed, get IP first, then ipapi.co/<ip>/json ---
    if (!data) {
      const ip = await this.tryGetIpViaJson(page);
      if (ip) {
        try {
          await page.goto(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { waitUntil: 'domcontentloaded' });
          const raw = await page.locator('pre, body').first().textContent();
          const parsed = this.safeJson(raw);
          if (parsed && parsed.ip) {
            data = this.coerceIpApiShape(parsed);
            source = `ipapi.co/${ip}/json`;
          }
        } catch {}
      }
    }

    // --- 3) Fallbacks (map to ipapi-like shape) ---
    if (!data) {
      // try ipwho.is
      try {
        await page.goto('https://ipwho.is/', { waitUntil: 'domcontentloaded' });
        const raw = await page.locator('pre, body').first().textContent();
        const parsed = this.safeJson(raw);
        if (parsed && parsed.ip) {
          data = this.mapIpwhoisToIpapi(parsed);
          source = 'ipwho.is';
        }
      } catch {}

      // try ipinfo.io
      if (!data) {
        try {
          await page.goto('https://ipinfo.io/json', { waitUntil: 'domcontentloaded' });
          const raw = await page.locator('pre, body').first().textContent();
          const parsed = this.safeJson(raw);
          if (parsed && parsed.ip) {
            data = this.mapIpinfoToIpapi(parsed);
            source = 'ipinfo.io';
          }
        } catch {}
      }
    }

    // --- 4) As a last resort, scrape whatismyipaddress for geo (if we managed to get an IP) ---
    if (!data) {
      const ip = await this.tryGetIpViaJson(page);
      if (ip) {
        const geo = await this.scrapeWhatIsMyIpAddress(page, ip);
        if (geo) {
          data = { ip, ...geo };
          source = 'whatismyipaddress.com (scrape)';
        }
      }
    }

    // Ensure we always return the full shape (fill with null/undefined defaults)
    const full: IpApiShape = this.fillIpApiDefaults(data || {});

    return {
      userAgent,
      engine: this._lastLaunch?.engine ?? 'unknown',
      executable: this._lastLaunch?.exec ?? 'bundled',
      source,
      ...full,
    };
  }, { label: 'connection-check', blockAnalytics: true, blockMedia: true });
  }
}
