import { Injectable, Scope } from '@nestjs/common';
import type { Page, Locator } from 'playwright';

export type HumanConfig = {
  // typing
  perCharDelayMs?: [number, number];
  typoChance?: number;
  microPauseChance?: number;
  microPauseMs?: [number, number];
  selectAllBeforeType?: boolean;

  // mouse
  moveSteps?: [number, number];
  innerSafeBox?: [number, number];

  // click
  clickDelayMs?: [number, number];
  clickHoldMs?: [number, number];

  // scroll
  scrollStepPx?: [number, number];
  scrollDelayMs?: [number, number];
  jitterEveryN?: number;
  jitterPx?: [number, number];
};

@Injectable()
export class PlaywrightHuman {
  private page!: Page;
  private cfg!: Required<HumanConfig>;

  public async createHuman(page: Page, cfg?: HumanConfig): Promise<PlaywrightHuman> {
    const human = new PlaywrightHuman();
    return human.setHumanBehaviour(page, cfg);
  }

  /** Call this before using any methods */
  private setHumanBehaviour(page: Page, cfg: HumanConfig = {}) {
    this.page = page;
    this.cfg = {
      perCharDelayMs: cfg.perCharDelayMs ?? [30, 120],
      typoChance: cfg.typoChance ?? 0.03,
      microPauseChance: cfg.microPauseChance ?? 0.06,
      microPauseMs: cfg.microPauseMs ?? [80, 220],
      selectAllBeforeType: cfg.selectAllBeforeType ?? false,

      moveSteps: cfg.moveSteps ?? [10, 20],
      innerSafeBox: cfg.innerSafeBox ?? [0.25, 0.75],

      clickDelayMs: cfg.clickDelayMs ?? [40, 120],
      clickHoldMs: cfg.clickHoldMs ?? [25, 80],

      scrollStepPx: cfg.scrollStepPx ?? [280, 520],
      scrollDelayMs: cfg.scrollDelayMs ?? [120, 260],
      jitterEveryN: cfg.jitterEveryN ?? 6,
      jitterPx: cfg.jitterPx ?? [4, 16],
    };
    return this;
  }

  // ---------- helpers ----------
  private ensurePage() {
    if (!this.page) throw new Error('PlaywrightHuman: page not set. Call setHumanBehaviour(page, cfg) first.');
  }
  private rnd(min: number, max: number) { return min + Math.random() * (max - min); }
  private rndi(min: number, max: number) { return Math.round(this.rnd(min, max)); }
  private toLocator(target: string | Locator): Locator { this.ensurePage(); return typeof target === 'string' ? this.page.locator(target) : target; }
  private pickPoint(box: { x: number; y: number; width: number; height: number }, inner: [number, number]) {
    const [a, b] = inner; return { x: box.x + this.rnd(a * box.width, b * box.width), y: box.y + this.rnd(a * box.height, b * box.height) };
  }

  // ---------- basics ----------
  wait(msMin: number, msMax?: number) {
    this.ensurePage();
    return this.page.waitForTimeout(msMax ? this.rndi(msMin, msMax) : msMin);
  }
  locator(target: string | Locator) { return this.toLocator(target); }

  async waitForVisible(target: string | Locator, timeout = 15_000) {
    this.ensurePage();
    await this.locator(target).waitFor({ state: 'visible', timeout });
  }

  async waitForStable(target: string | Locator, checks = 3, intervalMs = 150) {
    this.ensurePage();
    const loc = this.locator(target);
    let prev: string | null = null;
    for (let i = 0; i < checks; i++) {
      const box = await loc.boundingBox();
      if (!box) { await this.wait(intervalMs); i--; continue; }
      const curr = `${Math.round(box.x)}:${Math.round(box.y)}:${Math.round(box.width)}:${Math.round(box.height)}`;
      if (curr === prev) return true;
      prev = curr;
      await this.wait(intervalMs);
    }
    return true;
  }

  // ---------- mouse ----------
  private async moveMouseTo(x: number, y: number, steps?: number) {
    this.ensurePage();
    const s = steps ?? this.rndi(this.cfg.moveSteps[0], this.cfg.moveSteps[1]);
    await this.page.mouse.move(x, y, { steps: s });
  }

  async hover(target: string | Locator) {
    const loc = this.locator(target);
    const box = await loc.boundingBox();
    if (!box) { await loc.hover(); return; }
    const pt = this.pickPoint(box, this.cfg.innerSafeBox);
    await this.moveMouseTo(pt.x, pt.y);
    await this.wait(40, 120);
  }

  async click(target: string | Locator, opts?: {
    ensure?: 'visible' | 'attached',
    waitFor?: 'domcontentloaded' | 'load' | 'networkidle',
    button?: 'left' | 'right' | 'middle'
  }) {
    const loc = this.locator(target);
    if (opts?.ensure === 'visible') await loc.waitFor({ state: 'visible' });
    if (opts?.ensure === 'attached') await loc.waitFor({ state: 'attached' });

    const box = await loc.boundingBox();
    if (!box) {
      await this.wait(this.cfg.clickDelayMs[0], this.cfg.clickDelayMs[1]);
      await loc.click({ button: opts?.button ?? 'left', delay: this.rndi(this.cfg.clickHoldMs[0], this.cfg.clickHoldMs[1]) });
      return;
    }
    const pt = this.pickPoint(box, this.cfg.innerSafeBox);
    await this.moveMouseTo(pt.x, pt.y);
    await this.wait(this.cfg.clickDelayMs[0], this.cfg.clickDelayMs[1]);

    if (opts?.waitFor) {
      const p = this.page.waitForLoadState(opts.waitFor);
      await this.page.mouse.down({ button: opts?.button ?? 'left' });
      await this.wait(this.cfg.clickHoldMs[0], this.cfg.clickHoldMs[1]);
      await this.page.mouse.up({ button: opts?.button ?? 'left' });
      await p;
    } else {
      await this.page.mouse.down({ button: opts?.button ?? 'left' });
      await this.wait(this.cfg.clickHoldMs[0], this.cfg.clickHoldMs[1]);
      await this.page.mouse.up({ button: opts?.button ?? 'left' });
    }
  }

  async clickIfVisible(target: string | Locator) {
    const loc = this.locator(target);
    if (await loc.isVisible().catch(() => false)) { await this.click(loc); return true; }
    return false;
  }

  async clickText(text: string, exact = false) {
    this.ensurePage();
    const hasGetBy = typeof (this.page as any).getByText === 'function';
    const loc = hasGetBy ? (this.page as any).getByText(text, { exact }).first() : this.page.locator(`text=${text}`).first();
    await this.click(loc);
  }

  async clickNth(target: string, index: number) {
    const loc = this.page.locator(target).nth(index);
    await this.click(loc);
  }

  // ---------- typing / forms ----------
  private async inputVal(loc: Locator): Promise<string> {
    try { return await loc.inputValue({ timeout: 500 }); } catch { return ''; }
  }
  // inside PlaywrightHuman
  private async focusAndClear(loc: Locator) {
    // Ensure focus
    try { await loc.scrollIntoViewIfNeeded(); } catch {}
    try { await loc.click({ force: true }); } catch { try { await loc.focus(); } catch {} }

    // Quick attempt: fill('') triggers proper input events
    try { await (loc as any).fill(''); } catch {}

    // Close any autocomplete popups that might re-insert tokens
    try { await this.page.keyboard.press('Escape'); } catch {}

    // If still not empty, do select-all + delete cycles
    let v = await this.inputVal(loc);
    if (!v) return;

    // Try both Meta and Control modifiers (cross-platform)
    for (const mod of ['Meta', 'Control']) {
      try {
        await this.page.keyboard.press(`${mod}+A`).catch(() => {});
        await this.page.keyboard.press('Delete').catch(() => {});
        await this.page.keyboard.press('Backspace').catch(() => {});
      } catch {}
      v = await this.inputVal(loc);
      if (!v) return;
    }

    // Fallback: triple-click to select line, then backspace
    try { await loc.click({ clickCount: 3 }); await this.page.keyboard.press('Backspace'); } catch {}
    v = await this.inputVal(loc);
    if (!v) return;

    // Last resort: set value directly (keeps it safe & local to the element)
    try {
      await loc.evaluate(el => {
        const e = el as HTMLInputElement | HTMLTextAreaElement;
        if ('value' in e) e.value = '';
      });
    } catch {}
  }

  async typingBkp(
    target: string | Locator,
    text: string,
    opts?: {
      clearFirst?: boolean;
      selectAllFirst?: boolean;
      /** per-char typo simulation (old flag); accepts 'mistake' or 'mistakes' or 'typos' */
      typos?: boolean;
      /** occasional junk-word bursts that are immediately deleted */
      noisyBursts?: boolean;
      burstChance?: number;              // default 0.19 per ~word boundary
      burstLenRange?: [number, number];  // default [2, 6]
      burstDictionary?: string[];        // optional custom junk words
      delayRange?: [number, number];     // per-keystroke delay; default from cfg or [95,170]
    }
  ) {
    const loc = this.toLocator ? this.toLocator(target).first() : (target as Locator);
  
    // bring into view & focus
    try { await loc.scrollIntoViewIfNeeded(); } catch {}
    try { await loc.click({ force: true }); } catch { try { await loc.focus(); } catch {} }
  
    // clear if asked
    if (opts?.clearFirst || this.cfg?.selectAllBeforeType || opts?.selectAllFirst) {
      try { await this.focusAndClear(loc); } catch {}
    }
  
    // delays & chances
    const [dMin, dMax] = opts?.delayRange ?? this.cfg?.perCharDelayMs ?? [95, 170];
    const delay = () => this.rndi(dMin, dMax);
  
    const microPauseChance = this.cfg?.microPauseChance ?? 0.0;
    const microPauseMs     = this.cfg?.microPauseMs ?? [60, 120];
  
    const doTypos = (opts?.typos ?? false);
  
    const doBursts      = opts?.noisyBursts ?? true;         // enable by default (looks nice)
    const burstChance   = opts?.burstChance ?? 0.19;         // ~18% chance around boundaries
    const burstLenRange = opts?.burstLenRange ?? [2, 6];
  
    // fast path if NO typos & NO bursts & modern API available
    if (!doTypos && !doBursts && typeof (loc as any).pressSequentially === 'function') {
      try { await (loc as any).pressSequentially(text, { delay: delay() }); return; } catch {}
    }
  
    // iterate characters; insert bursts near word boundaries
    const isBoundary = (prev: string, curr: string) => prev === ' ' || prev === '' || curr === ' ';
  
    let prev = '';
    for (const ch of text) {
      // maybe inject a junk-word burst around boundaries (then delete it)
      if (doBursts && isBoundary(prev, ch) && Math.random() < burstChance) {
        const junk = this.randomNoiseWord(opts?.burstDictionary, burstLenRange);
        // type junk
        for (const j of junk) {
          try { await this.page.keyboard.type(j, { delay: delay() }); } catch {}
        }
        // small thinking pause
        if (Math.random() < 0.5) await this.wait(microPauseMs[0], microPauseMs[1]);
        // delete junk
        await this.backspaceTimes(junk.length, [Math.max(40, dMin - 30), dMax]);
      }
  
      // per-char typo (neighbor key) then fix
      if (doTypos && Math.random() < (this.cfg?.typoChance ?? 0.12)) {
        const wrong = this.neighborChar(ch);
        try { await this.page.keyboard.type(wrong, { delay: delay() }); } catch {}
        await this.wait(microPauseMs[0], microPauseMs[1]);
        try { await this.page.keyboard.press('Backspace'); } catch {}
      }
  
      // type the intended char
      try { await this.page.keyboard.type(ch, { delay: delay() }); } catch {}
  
      // micro hesitation
      if (Math.random() < microPauseChance) {
        await this.wait(microPauseMs[0], microPauseMs[1]);
      }
      prev = ch;
    }
  }

  async typing(
    target: string | Locator,
    text: string,
    opts?: {
      clearFirst?: boolean;
      selectAllFirst?: boolean;
      /** per-char typo simulation (old flag); accepts 'mistake' or 'mistakes' or 'typos' */
      typos?: boolean;
      /** occasional junk-word bursts that are immediately deleted */
      noisyBursts?: boolean;
      burstChance?: number;              // default 0.19 per ~word boundary
      burstLenRange?: [number, number];  // default [2, 6]
      burstDictionary?: string[];        // optional custom junk words
      delayRange?: [number, number];     // per-keystroke delay; default from cfg or [95,170]
      /** faster than normal typing; used only when pressing Backspace to fix a typo */
      backspaceDelayRange?: [number, number];
    }
  ) {
    const loc = this.toLocator ? this.toLocator(target).first() : (target as Locator);
  
    // bring into view & focus
    try { await loc.scrollIntoViewIfNeeded(); } catch {}
    try { await loc.click({ force: true }); } catch { try { await loc.focus(); } catch {} }
  
    // clear if asked
    if (opts?.clearFirst || this.cfg?.selectAllBeforeType || opts?.selectAllFirst) {
      try { await this.focusAndClear(loc); } catch {}
    }
  
    // delays & chances
    const [dMin, dMax] = opts?.delayRange ?? this.cfg?.perCharDelayMs ?? [95, 170];
    const delay = () => this.rndi(dMin, dMax);

    // Make Backspace faster than regular typing when fixing typos
    const bsRange: [number, number] =
      opts?.backspaceDelayRange
      ?? [Math.max(20, Math.floor(dMin * 0.15)),  // lower bound ~15% of normal min
          Math.max(35, Math.floor(dMin * 0.35))]; // upper bound ~35% of normal min

    const microPauseChance = this.cfg?.microPauseChance ?? 0.0;
    const microPauseMs     = this.cfg?.microPauseMs ?? [60, 120];
  
    const doTypos = (opts?.typos ?? false);
  
    const doBursts      = opts?.noisyBursts ?? true;         // enable by default (looks nice)
    const burstChance   = opts?.burstChance ?? 0.19;         // ~18% chance around boundaries
    const burstLenRange = opts?.burstLenRange ?? [2, 6];
  
    // fast path if NO typos & NO bursts & modern API available
    if (!doTypos && !doBursts && typeof (loc as any).pressSequentially === 'function') {
      try { await (loc as any).pressSequentially(text, { delay: delay() }); return; } catch {}
    }
  
    // iterate characters; insert bursts near word boundaries
    const isBoundary = (prev: string, curr: string) => prev === ' ' || prev === '' || curr === ' ';
  
    let prev = '';
    for (const ch of text) {
      // maybe inject a junk-word burst around boundaries (then delete it)
      if (doBursts && isBoundary(prev, ch) && Math.random() < burstChance) {
        const junk = this.randomNoiseWord(opts?.burstDictionary, burstLenRange);
        // type junk
        for (const j of junk) {
          try { await this.page.keyboard.type(j, { delay: delay() }); } catch {}
        }
        // small thinking pause
        if (Math.random() < 0.5) await this.wait(microPauseMs[0], microPauseMs[1]);
        // delete junk
        await this.backspaceTimes(junk.length, [Math.max(40, dMin - 30), dMax]);
      }
  
      // per-char typo (neighbor key) then fix
      if (doTypos && Math.random() < (this.cfg?.typoChance ?? 0.12)) {
        const wrong = this.neighborChar(ch);
        try { await this.page.keyboard.type(wrong, { delay: delay() }); } catch {}
        await this.wait(microPauseMs[0], microPauseMs[1]);
        try { await this.page.keyboard.press('Backspace', { delay: this.rndi(bsRange[0], bsRange[1]) }); } catch {}
      }
  
      // type the intended char
      try { await this.page.keyboard.type(ch, { delay: delay() }); } catch {}
  
      // micro hesitation
      if (Math.random() < microPauseChance) {
        await this.wait(microPauseMs[0], microPauseMs[1]);
      }
      prev = ch;
    }
  }

  private async backspaceTimes(times: number, delayRange: [number, number]) {
    for (let i = 0; i < times; i++) {
      await this.page.keyboard.press('Backspace', { delay: this.rndi(delayRange[0], delayRange[1]) }).catch(() => {});
    }
  }
  
  private randomNoiseWord(dict?: string[], lenRange: [number, number] = [2, 6]): string {
    const stock = dict?.length ? dict : ['teh', 'adn', 'hte', 'umm', 'ops', 'oops', 'oky', 'hmm', '...'];
    // 50% pick from dict, else random letters
    if (Math.random() < 0.5) return stock[this.rndi(0, stock.length - 1)];
    const len = this.rndi(lenRange[0], lenRange[1]);
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let s = '';
    for (let i = 0; i < len; i++) s += letters[this.rndi(0, letters.length - 1)];
    return s;
  }

  private neighborChar(c: string) { return String.fromCharCode(c.charCodeAt(0) + 1); } // simple "nearby" key


  async paste(target: string | Locator, text: string) {
    const loc = this.locator(target);
    await loc.fill(text, { timeout: 15_000 });
  }

  async selectDropdown(target: string | Locator, valueOrLabel: string) {
    const loc = this.locator(target);
    try { await loc.selectOption({ value: valueOrLabel }); }
    catch { await loc.selectOption({ label: valueOrLabel }); }
  }

  async fillForm(fields: Record<string, string | boolean>) {
    for (const [selector, val] of Object.entries(fields)) {
      const loc = this.page.locator(selector);
      const tag = (await loc.evaluate(el => el.tagName).catch(() => 'INPUT')) as string;
      const type = (await loc.getAttribute('type').catch(() => null))?.toLowerCase();

      if (typeof val === 'boolean') {
        if (type === 'checkbox') await loc.setChecked(!!val).catch(()=>{});
        else await loc.click().catch(()=>{});
        continue;
      }

      if (tag === 'SELECT') await this.selectDropdown(loc, val);
      else if (type === 'checkbox' || type === 'radio') await loc.click().catch(()=>{});
      else await this.paste(loc, val);

      await this.sometimesPause();
    }
  }

  // ---------- scroll ----------
  // --- helpers (add once in the class) ---
// ---------- Smooth scrolling pack (evaluate-free) ----------

// Keep this if you already have it
private isCtxDestroyed(e: any): boolean {
  return /Execution context was destroyed/i.test(String(e?.message || e));
}

// 1) Low-level: wheel/keyboard first, eval only as last resort (and swallow SPA replacement error)
private async scrollBy(deltaY: number) {
  this.ensurePage();

  // Prefer driver-side wheel (smooth & safe)
  try { await this.page.mouse.wheel(0, deltaY); return; } catch {}

  // Fallback to keyboard
  try { await this.page.keyboard.press(deltaY > 0 ? 'PageDown' : 'PageUp'); return; } catch {}

  // Last resort: evaluate (swallow SPA error)
  try {
    await this.page.evaluate((dy) => { window.scrollBy({ top: dy, behavior: 'auto' }); }, deltaY);
  } catch (e) {
    if (!this.isCtxDestroyed(e)) throw e;
  }
}

// 2) Easing helper (easeOutCubic by default)
private easeOutCubic(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.pow(1 - t, 3);
}

// 3) Super-smooth wheel animation over time (no evaluate)
private async smoothWheelBy(
  distance: number,
  durationMs = 1100,
  opts?: { easing?: (t: number) => number; minFrameMs?: number; jitterPx?: number }
) {
  const easing = opts?.easing ?? this.easeOutCubic;
  const frame = Math.max(12, opts?.minFrameMs ?? 16); // ~60–80 FPS cap
  const jitter = opts?.jitterPx ?? 0.8;

  const start = Date.now();
  let sent = 0;

  for (;;) {
    const elapsed = Date.now() - start;
    const t = Math.min(1, elapsed / durationMs);
    const target = distance * easing(t);

    // remaining delta for this frame
    let delta = target - sent;

    // add tiny "hand wobble"
    if (jitter) {
      delta += (Math.random() * 2 - 1) * jitter; // [-jitter, +jitter]
    }

    if (Math.abs(delta) > 0.5) {
      await this.page.mouse.wheel(0, delta);
      sent += delta;
    }

    if (t >= 1) break;
    await this.page.waitForTimeout(frame);
  }
}

// 4) Smooth scroll to bottom using chunks (evaluate only to read metrics, safely)
private async safeReadScroll(): Promise<{ y: number; H: number; h: number } | null> {
  try {
    return await this.page.evaluate(() => ({
      y: window.scrollY,
      H: window.innerHeight,
      h: document.documentElement.scrollHeight,
    }));
  } catch (e) {
    if (!this.isCtxDestroyed(e)) throw e;
    return null;
  }
}

public async smoothScrollToBottom(maxPixels?: number) {
  let total = 0;
  await this.sometimesPause(0.65, [300, 700]);
  while (true) {
    // read current metrics
    const m = await this.safeReadScroll();
    // pick a chunk ≈ 60–80% viewport for natural feel
    const chunk = m ? Math.max(120, Math.floor(m.H * (0.6 + Math.random() * 0.2))) : 400;

    const step = this.rndi(0.7 * chunk, 1.1 * chunk);
    await this.smoothWheelBy(step, this.rndi(900, 1200), { jitterPx: 0.6 });

    total += step;
    await this.wait(this.cfg.scrollDelayMs[0], this.cfg.scrollDelayMs[1]);

    const m2 = await this.safeReadScroll();
    if (m2) {
      const atBottom = m2.y + m2.H + 8 >= m2.h;
      if (atBottom) break;
    }
    if (typeof maxPixels === 'number' && total >= maxPixels) break;
  }
  await this.sometimesPause(0.92, [1000, 1700]);
}

// 5) Smooth scroll to top (mirror of bottom)
public async smoothScrollToTop() {
  await this.sometimesPause(0.7, [500, 900]);
  for (;;) {
    const m = await this.safeReadScroll();
    if (m && m.y <= 0) break;

    const chunk = m ? Math.max(120, Math.floor(m.H * (0.55 + Math.random() * 0.2))) : 300;
    const step = this.rndi(0.7 * chunk, 1.1 * chunk);
    await this.smoothWheelBy(-step, this.rndi(800, 1000), { jitterPx: 0.6 });

    await this.wait(this.cfg.scrollDelayMs[0], this.cfg.scrollDelayMs[1]);
    const m2 = await this.safeReadScroll();
    if (m2 && m2.y <= 0) break;
  }
  await this.sometimesPause(0.95, [900, 1800]);
}

// 6) Scroll target into view, then apply a small easing offset to place it nicely
public async scrollIntoView(target: string | Locator, offsetPx = 120) {
  await this.sometimesPause(0.7, [200, 800]);
  const loc = this.toLocator(target).first();
  try { await loc.scrollIntoViewIfNeeded(); } catch {}
  // nudge the target down from the very top (reads nicer)
  await this.smoothWheelBy(-Math.abs(offsetPx), this.rndi(500, 1100), { jitterPx: 0.3 });
  await this.sometimesPause(0.9, [1100, 2000]);
}
  async sometimesPause(chance = 0.55, msRange: [number, number] = [300, 1200]) {
    if (Math.random() < chance) await this.wait(msRange[0], msRange[1]);
  }

  // ---------- drag/drop & upload ----------
  async dragAndDrop(source: string | Locator, target: string | Locator) {
    const from = this.locator(source);
    const to = this.locator(target);
    await from.dragTo(to);
  }

  async uploadFile(inputSelector: string | Locator, filePath: string) {
    const input = this.locator(inputSelector);
    await input.setInputFiles(filePath);
  }

  // ===== Minimal forever-style helpers =====
  private async until(
    check: () => Promise<boolean>,
    opts?: { delay?: number; deadlineMs?: number }
  ): Promise<boolean> {
    const delay = opts?.delay ?? 200;
    const start = Date.now();
    for (;;) {
      try { if (await check()) return true; } catch {}
      if (opts?.deadlineMs && Date.now() - start >= opts.deadlineMs) return false;
      await this.page.waitForTimeout(delay);
    }
  }
  
  private resolveOpts(
    delayOrOpts?: number | { delay?: number; deadlineMs?: number; hover?: boolean; throwOnTimeout?: boolean }
  ): { delay?: number; deadlineMs?: number; hover?: boolean; throwOnTimeout?: boolean } {
    if (typeof delayOrOpts === 'number') return { delay: delayOrOpts };
    return delayOrOpts ?? {};
  }

  private async forever(check: () => Promise<boolean>, delay = 200): Promise<void> {
    for (;;) {
      try { if (await check()) return; } catch {}
      await this.page.waitForTimeout(delay);
    }
  }

  public async openForever(
    url: string,
    ready: string | Locator,
    delayOrOpts?: number | { delay?: number; deadlineMs?: number; throwOnTimeout?: boolean }
  ): Promise<boolean> {
    const opts = this.resolveOpts(delayOrOpts);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    const ok = await this.visibleForever(ready, opts);
    if (!ok && (opts.throwOnTimeout ?? true)) throw new Error('openForever: deadline exceeded');
    return ok;
  }

  public async visibleForever(
    target: string | Locator,
    delayOrOpts?: number | { delay?: number; deadlineMs?: number; throwOnTimeout?: boolean }
  ): Promise<boolean> {
    const opts = this.resolveOpts(delayOrOpts);
    const loc = this.toLocator(target).first();
    const ok = await this.until(async () => await loc.isVisible().catch(() => false), opts);
    if (!ok && (opts.throwOnTimeout ?? false)) throw new Error('visibleForever: deadline exceeded');
    return ok;
  }

public async clickAndWaitVisibleForever(
  clickTarget: string | Locator,
  waitTarget: string | Locator,
  delayOrOpts?: number | { delay?: number; deadlineMs?: number; hover?: boolean; throwOnTimeout?: boolean }
): Promise<boolean> {
  const opts = this.resolveOpts(delayOrOpts);
  const c = this.toLocator(clickTarget).first();
  await c.scrollIntoViewIfNeeded().catch(() => {});
  if (opts.hover) { await this.hover(c).catch(() => {}); }
  await this.click(c).catch(() => {});
  const ok = await this.visibleForever(waitTarget, opts);
  if (!ok && (opts.throwOnTimeout ?? true)) throw new Error('clickAndWaitVisibleForever: deadline exceeded');
  return ok;
}

public async backForever(
  ready: string | Locator,
  delayOrOpts?: number | { delay?: number; deadlineMs?: number; throwOnTimeout?: boolean }
): Promise<boolean> {
  const opts = this.resolveOpts(delayOrOpts);

  // 1) Try SPA back (swallow the common "execution context was destroyed" blip)
  try { await this.page.evaluate(() => history.back()); } catch { /* benign during SPA swap */ }

  // 2) Wait for the target to become visible (no-throw on this first attempt)
  let ok = await this.visibleForever(ready, { delay: opts.delay, deadlineMs: opts.deadlineMs, throwOnTimeout: false });
  if (ok) return true;

  // 3) Fallback to real navigation commit, then wait again
  try {
    const navTimeout = Math.max(3000, Math.min(10000, Math.floor((opts.deadlineMs ?? 10000) / 2)));
    await this.page.goBack({ waitUntil: 'commit', timeout: navTimeout });
  } catch { /* ignore */ }

  ok = await this.visibleForever(ready, { delay: opts.delay, deadlineMs: opts.deadlineMs, throwOnTimeout: false });

  if (!ok && (opts.throwOnTimeout ?? true)) throw new Error('backForever: deadline exceeded');
  return ok;
}
  // ---------- fuzzy text + labels ----------
  async findByText(text: string, opts?: { exact?: boolean; tagFilter?: string[] }) {
    this.ensurePage();
    const exact = opts?.exact ?? false;
    const tagFilter = opts?.tagFilter ?? ['a','button','[role="button"]','[role="link"]','input[@type="submit"]','input[@type="button"]'];

    const getByRole = (this.page as any).getByRole?.bind(this.page);
    if (getByRole) {
      for (const role of ['button','link']) {
        const loc = getByRole(role, { name: text, exact }).first();
        if (await loc.count() > 0) return loc;
      }
    }
    const getByText = (this.page as any).getByText?.bind(this.page);
    if (getByText) {
      const loc = getByText(text, { exact }).first();
      if (await loc.count() > 0) return loc;
    }
    const lower = text.toLowerCase();
    const translateExpr = "translate(normalize-space(string(.)),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')";
    const tags = tagFilter.join(' | ');
    const xpath = `xpath=(//${tags})[contains(${translateExpr}, ${JSON.stringify(lower)})]`;
    const xloc = this.page.locator(xpath).first();
    if (await xloc.count() > 0) return xloc;

    const xpAll = `xpath=(//*[contains(${translateExpr}, ${JSON.stringify(lower)})])`;
    return this.page.locator(xpAll).first();
  }

  async findAndClickText(text: string, opts?: { exact?: boolean; waitFor?: 'domcontentloaded' | 'load' | 'networkidle'; tagFilter?: string[] }) {
    const loc = await this.findByText(text, { exact: opts?.exact, tagFilter: opts?.tagFilter });
    await this.click(loc, { waitFor: opts?.waitFor });
  }

  async pressKey(key: string) { this.ensurePage(); await this.page.keyboard.press(key); }
  async pressEnter() { return this.pressKey('Enter'); }
  async pressTab() { return this.pressKey('Tab'); }

  async findInputByLabel(label: string): Promise<Locator> {
    this.ensurePage();
    const hasGetByLabel = typeof (this.page as any).getByLabel === 'function';
    if (hasGetByLabel) {
      const byLabel = (this.page as any).getByLabel(label, { exact: false }).first();
      if (await byLabel.count() > 0) return byLabel;
    }
    const q = label.trim();
    const candidates = this.page.locator(
      `input[placeholder*="${q}" i], textarea[placeholder*="${q}" i], ` +
      `input[aria-label*="${q}" i], textarea[aria-label*="${q}" i], select[aria-label*="${q}" i], ` +
      `input[name*="${q}" i], select[name*="${q}" i], textarea[name*="${q}" i]`
    ).first();
    if (await candidates.count() > 0) return candidates;

    const xp = `
      xpath=
      //label[contains(translate(normalize-space(string(.)),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), ${JSON.stringify(q.toLowerCase())})]
      /following::input[1] | 
      //label[contains(translate(normalize-space(string(.)),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), ${JSON.stringify(q.toLowerCase())})]
      /following::textarea[1] |
      //label[contains(translate(normalize-space(string(.)),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), ${JSON.stringify(q.toLowerCase())})]
      /following::select[1]
    `;
    const near = this.page.locator(xp).first();
    if (await near.count() > 0) return near;

    throw new Error(`Input for label "${label}" not found`);
  }

  async fillFormByLabels(fields: Record<string, string | boolean>) {
    this.ensurePage();
    for (const [label, val] of Object.entries(fields)) {
      try {
        const el = await this.findInputByLabel(label);
        const tag = (await el.evaluate(e => e.tagName).catch(() => 'INPUT')) as string;
        const type = (await el.getAttribute('type').catch(() => null))?.toLowerCase();

        if (typeof val === 'boolean') {
          if (type === 'checkbox') await el.setChecked(!!val).catch(()=>{});
          else if (type === 'radio') { if (val) await el.check().catch(()=>{}); }
          else { if (val) await el.click().catch(()=>{}); }
          continue;
        }

        if (tag === 'SELECT') await this.selectDropdown(el, val);
        else if (type === 'checkbox' || type === 'radio') await el.click().catch(()=>{});
        else await this.paste(el, val);

        await this.sometimesPause();
      } catch { /* soft-fail per field */ }
    }
  }

  // ---------- high-level ----------
  async safeClickNav(target: string | Locator, waitFor: 'domcontentloaded'|'load'|'networkidle' = 'domcontentloaded') {
    await this.click(target, { waitFor });
  }

  async autoPaginate(nextSelector: string, perPage: (page: Page, H: PlaywrightHuman, pageIndex: number) => Promise<void>, opts?: {
    maxPages?: number;
    waitAfterClickMs?: [number, number];
    stopWhenDisabled?: boolean;
  }) {
    this.ensurePage();
    const max = opts?.maxPages ?? 20;
    const waitRange = opts?.waitAfterClickMs ?? [800, 1800];
    for (let i = 0; i < max; i++) {
      await perPage(this.page, this, i);
      const next = this.page.locator(nextSelector);
      if (!(await next.isVisible().catch(() => false))) break;
      if (opts?.stopWhenDisabled) {
        const disabled = await next.getAttribute('disabled').catch(() => null);
        if (disabled !== null) break;
      }
      await this.safeClickNav(next);
      await this.wait(waitRange[0], waitRange[1]);
    }
  }

  /** Try to solve PerimeterX "Press & Hold" captcha if present.
   * Returns true if solved, false if not present or not solved in time.
   */
  /** Try to solve PerimeterX "Press & Hold" captcha if present.
 * Returns true if solved, false if not present or not solved in time.
 */
  // Inside PlaywrightHuman class
public async trySolvePxPressHold(deadlineMs = 25_000): Promise<boolean> {
  // we need to develop this method
  // try with Belgium VPN it will prompt verification
  /*
  There is a human verification page
  Which can trigger any time during surfing.

  to identify this page we need to check for element
  selector: div[id="px-captcha"]

  this puzzel is hold a button untill it it fill with blue color 
  we can determind it from dom
  now where to click?
  selector: div[id="px-captcha"] iframe:nth-child(3) div[dir="auto"] div[aria-label="Press & Hold"] //p[contains(text(), "Press & Hold")]
  you need to click on p tag with text Press & Hold

  here we need to keep holdiing the click until
  selector: div[id="px-captcha"] iframe:nth-child(3) div[dir="auto"] div[aria-label="Press & Hold"] 
  becomes
  selector: div[id="px-captcha"] iframe:nth-child(3) div[dir="auto"] div[aria-label="Human Challenge completed, please wait"]

  once selector found release the click and wait for dom to finish loading

  //p[contains(text(), "Press & Hold")]
  */
  return true;
  const root = this.page.locator('#px-captcha').first();

  // Fast exit if not present/visible
  try {
    if (await root.count() === 0) return false;
    if (!(await root.isVisible().catch(() => false))) return false;
  } catch { return false; }

  // Enumerate iframes under #px-captcha (FrameLocator.nth is deprecated, so use contentFrame())
  const iframes = this.page.locator('#px-captcha iframe');
  const n = await iframes.count().catch(() => 0);
  if (n === 0) return false;

  for (let i = 0; i < n; i++) {
    const handle = await iframes.nth(i).elementHandle().catch(() => null);
    if (!handle) continue;
    const frame = await handle.contentFrame().catch(() => null);
    if (!frame) continue; // cross-origin frames still yield a Frame; continue if null

    // Find the press area inside this frame
    const holdDiv = frame.locator('div[dir="auto"] div[aria-label*="Press & Hold"]').first();
    const holdP   = frame.locator('p:has-text("Press & Hold")').first();
    const hasDiv  = (await holdDiv.count().catch(() => 0)) > 0;
    const hasP    = (await holdP.count().catch(() => 0)) > 0;
    if (!hasDiv && !hasP) continue;

    const target = hasDiv ? holdDiv : holdP;
    try { await target.scrollIntoViewIfNeeded(); } catch {}

    // Hover centers the cursor inside the iframe; then hold mouse down
    try { await target.hover(); } catch {}
    try { await this.page.mouse.down(); } catch {}

    // Poll aria-label until it becomes "Human Challenge completed, please wait"
    const status = frame.locator('div[dir="auto"] div[aria-label]').first();
    const start = Date.now();
    let solved = false;
    while (Date.now() - start < deadlineMs) {
      const label = (await status.getAttribute('aria-label').catch(() => null)) || '';
      if (/Human Challenge completed/i.test(label)) { solved = true; break; }
      await this.page.waitForTimeout(150);
    }

    // Release the hold
    try { await this.page.mouse.up(); } catch {}

    if (!solved) continue;

    // Wait for the captcha container to disappear (or at least hide)
    const t0 = Date.now();
    while (Date.now() - t0 < 10_000) {
      const vis = await root.isVisible().catch(() => false);
      if (!vis) break;
      await this.page.waitForTimeout(200);
    }
    return true;
  }

  return false; // no matching frame / not solved
}



}
