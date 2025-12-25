import { ConfService, LogService, WebCrawlerService } from '@libs/library-app';
import { Injectable } from '@nestjs/common';
import { Browser, chromium, firefox, webkit } from 'playwright';
import * as fs from 'node:fs';
import { randomInt } from 'node:crypto';
import path, { join } from 'path';
import { format } from 'date-fns';

export type ScrapedRow = {
  listIndex: number;
  listName?: string | null;
  listCompany?: string | null;
  detail?: {
    url: string;
    website?: string | null;
    facebook?: string | null;
  };
};

@Injectable()
export class ZillowCrawlerServiceX {
  constructor(
    private readonly conf: ConfService,
    private readonly log: LogService,
    private readonly crawler: WebCrawlerService,

  ) {}

  // ========= SELECTORS (class fields for easy maintenance) =========

  // LIST
  private readonly SEL_ITEM_LINK = 'a[class^="StyledCard-"][role="link"]';
  private readonly SEL_ITEM_NAME = 'a[class^="StyledCard-"][role="link"] h2';
  private readonly SEL_ITEM_COMPANY = 'a[class^="StyledCard-"][role="link"] h2 + span';

  // PAGINATION
  private readonly SEL_PAGINATION_PAGE = 'nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"] button';
  private readonly SEL_PAGINATION_CUR = 'nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"] [aria-current="page"] button';

  private readonly SEL_PREV = 'nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:first-child button';
  private readonly SEL_PREV_ENABLED = 'nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:first-child button[aria-disabled="false"]';
  private readonly SEL_PREV_DISABLED = 'nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:first-child button[aria-disabled="true"]';

  private readonly SEL_NEXT = 'nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:last-child button';
  private readonly SEL_NEXT_ENABLED = 'nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:last-child button[aria-disabled="false"]';
  private readonly SEL_NEXT_DISABLED = 'nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:last-child button[aria-disabled="true"]';

  // DETAIL (within section#get-to-know-me)
  private readonly SEL_DETAIL_SECTION = 'section#get-to-know-me';
  private readonly SEL_WEBSITE = 'section#get-to-know-me a[class^="StyledTextButton-"]';
  private readonly SEL_FACEBOOK = 'section#get-to-know-me a[href*="facebook"]';

  // ========= PUBLIC =========

  public checkConnection() {
    return this.crawler.checkConnection();
  }

  public async humanCrawl(startUrl: string): Promise<ScrapedRow[]> {
    return this.crawler.withHumanPage(async (page) => this.crawl(startUrl)); 
  }
  /**
   * For now: scrape only 2 listings from page 1 (testing).
   * Pagination helpers are implemented but early-exit after 2 records.
   */
  public async crawl(startUrl: string): Promise<ScrapedRow[]> {
    const rows: ScrapedRow[] = [];

    await this.crawler.withPage(async (page) => {
      await page.goto(startUrl, { waitUntil: 'networkidle' });

      // ---- PAGE 1 ONLY (but keep pagination helpers ready) ----
      const items = page.locator(this.SEL_ITEM_LINK);
      const count = await items.count();

      const max = Math.min(count, 2); // <- limit for this stage
      for (let i = 0; i < max; i++) {
        // capture list-level info before clicking
        const name = await page.locator(this.SEL_ITEM_NAME).nth(i).textContent().catch(() => null);
        const company = await page.locator(this.SEL_ITEM_COMPANY).nth(i).textContent().catch(() => null);

        // open detail (same tab or popup)
        const rowLink = page.locator(this.SEL_ITEM_LINK).nth(i);
        const [popup] = await Promise.all([
          page.waitForEvent('popup').catch(() => null),
          rowLink.click(),
          page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => null),
        ]);
        const detailPage = popup ?? page;

        // wait for detail section (best-effort)
        await detailPage.locator(this.SEL_DETAIL_SECTION).first().waitFor({ timeout: 10000 }).catch(() => {});

        // collect info (skip if not present)
        const website = await this.getHref(detailPage, this.SEL_WEBSITE);
        const facebook = await this.getHref(detailPage, this.SEL_FACEBOOK);

        rows.push({
          listIndex: i,
          listName: name?.trim() || null,
          listCompany: company?.trim() || null,
          detail: {
            url: detailPage.url(),
            website,
            facebook,
          },
        });

        // back to list
        if (popup) {
          await popup.close().catch(() => {});
        } else {
          await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
          await page.waitForLoadState('networkidle').catch(() => {});
        }
      }

      // NOTE: pagination helpers below are implemented and ready,
      // but we stop after 2 rows per your Stage 1 requirement.
      // Uncomment later to iterate pages:
      //
      // while (!(await this.isNextDisabled(page))) {
      //   await this.clickNext(page);
      //   // repeat list scraping here...
      // }
    }, { 
      url: startUrl, 
      label: 'zillow.com',

      // for persistent connection just pass session id 
      //persistentSessionId: 'zillow-crawler',         // cookies persist in /assets/tmp/persistent/lead-52
      //persistentKeepAliveMs: 15 * 60_000,     // optional auto-close after 15m idle
    });


    /*********************************
    // Reference for persistent connection
    // reuse login and cookies across calls for the same session id
      await webCrawler.withPagePersistent('lead-52', async (page) => {
        await page.goto('https://example.com/login', { waitUntil: 'domcontentloaded' });
        // ... do login & scraping ...
      }, { url: 'https://example.com', label: 'example-login' }, 15 * 60_000); // keep alive 15 min

      // later, when you want to reset/delete this profile:
      await webCrawler.cleanupPersistentSession('lead-52');
    **********************************/

    this.log.info({ total: rows.length }, 'scrape finished');
    // also print to console as requested
    // (real apps might persist to DB instead)
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(rows, null, 2));

    return rows;
  }

  // ========= helpers =========

  private async getHref(page: any, sel: string): Promise<string | null> {
    const loc = page.locator(sel).first();
    if (await loc.count() === 0) return null;
    const href = await loc.getAttribute('href');
    return href?.trim() || null;
  }

  private async isNextEnabled(page: any) {
    return (await page.locator(this.SEL_NEXT_ENABLED).count()) > 0;
  }
  private async isNextDisabled(page: any) {
    return (await page.locator(this.SEL_NEXT_DISABLED).count()) > 0;
  }
  private async clickNext(page: any) {
    if (!(await this.isNextEnabled(page))) return false;
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.locator(this.SEL_NEXT).first().click(),
    ]);
    return true;
  }

  private async isPrevEnabled(page: any) {
    return (await page.locator(this.SEL_PREV_ENABLED).count()) > 0;
  }
  private async isPrevDisabled(page: any) {
    return (await page.locator(this.SEL_PREV_DISABLED).count()) > 0;
  }
  private async clickPrev(page: any) {
    if (!(await this.isPrevEnabled(page))) return false;
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.locator(this.SEL_PREV).first().click(),
    ]);
    return true;
  }
  // ========= not in use =========
  
  public async crawlManual(startUrl: string): Promise<any> {
    // pick from env
    const browserSpec = (this.conf as any).playwrightBrowser || process.env.PLAYWRIGHT_BROWSER || 'chromium';
    let browser: Browser | null = null;

    try {
      if (['chromium', 'chrome'].includes(browserSpec)) {
        browser = await chromium.launch({
          headless: this.conf.playwrightHeadless,
          slowMo: this.conf.playwrightSlowmoMs,
          
          // if PLAYWRIGHT_BROWSER is a path, use it
          executablePath: fs.existsSync(browserSpec) ? browserSpec : undefined,
        });
      } else if (browserSpec === 'firefox') {
        browser = await firefox.launch({ headless: this.conf.playwrightHeadless, slowMo: this.conf.playwrightSlowmoMs });
      } else if (browserSpec === 'webkit' || browserSpec === 'safari') {
        browser = await webkit.launch({ headless: this.conf.playwrightHeadless, slowMo: this.conf.playwrightSlowmoMs });
      } else if (fs.existsSync(browserSpec)) {
        // custom path (Chrome, Edge, etc.)
        browser = await chromium.launch({
          headless: this.conf.playwrightHeadless,
          slowMo: this.conf.playwrightSlowmoMs,
          executablePath: browserSpec,
        });
      } else {
        throw new Error(`Unsupported PLAYWRIGHT_BROWSER value: ${browserSpec}`);
      }

      const context = await browser.newContext({
        recordVideo: {
          dir: this.conf.playwrightVideoDirPath
        }
      });
      const page = await context.newPage();

      // create result storage
      const results: { page: number; person: string | null; company: string | null }[] = [];

      // open the wurl
      await page.goto(startUrl, { waitUntil: 'domcontentloaded' });

      await page.waitForTimeout(randomInt(1000, 3000));
      await page.mouse.wheel(0, 10);
      await page.mouse.wheel(0, 20);
      await page.waitForTimeout(987);
      // Page 1
      const person1 = await page.locator(this.SEL_ITEM_NAME).first().textContent().catch(() => null);
      const company1 = await page.locator(this.SEL_ITEM_COMPANY).first().textContent().catch(() => null);
      results.push({ page: 1, person: person1?.trim() || null, company: company1?.trim() || null });

      await page.waitForTimeout(324);

      await page.mouse.wheel(0, 234);
      await page.mouse.wheel(0, 789);
      await page.mouse.wheel(0, 989);
      await page.mouse.wheel(0, 1084);

      await page.waitForTimeout(500);

      // Page 2
      //await page.locator(this.SEL_NEXT).click();
      // Get the bounding box of the element. It returns null if the element is not visible.
      const cordinates = await page.locator(this.SEL_NEXT).boundingBox();

      if(cordinates){
        await page.mouse.wheel(0, -400);
        await page.mouse.move(cordinates.x, cordinates.y);
        await page.locator(this.SEL_NEXT).hover();
        await page.waitForTimeout(100);
        await page.locator(this.SEL_NEXT).click();

        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        const person2 = await page.locator(this.SEL_ITEM_NAME).first().textContent().catch(() => null);
        const company2 = await page.locator(this.SEL_ITEM_COMPANY).first().textContent().catch(() => null);
        results.push({ page: 2, person: person2?.trim() || null, company: company2?.trim() || null });
      }
      
      this.log.info({ total: results.length }, 'crawlManual finished');
      console.log('crawlManual results:',JSON.stringify(results, null, 2));

      return results;
    } catch (err) {
      console.error('crawlManual error:', err);
      return null;
    } finally {
      if (browser) await browser.close();
    }
  }

  public async crawlOverCDP(startUrl: string): Promise<any>{
      const browser = await chromium.connectOverCDP('http://localhost:9222');
      const context = browser.contexts()[0];   // reuse existing profile
      const page = await context.newPage();

    try {
      // create result storage
      const results: { page: number; person: string | null; company: string | null }[] = [];

      // open the wurl
      await page.goto(startUrl, { waitUntil: 'domcontentloaded' });

      await page.waitForTimeout(randomInt(1000, 3000));
      await page.mouse.wheel(0, 10);
      await page.mouse.wheel(0, 20);
      await page.waitForTimeout(987);
      // Page 1 record 1
      const pageFirst = page.locator(this.SEL_ITEM_LINK); 
      const person1 = await pageFirst.nth(0).locator('h2').textContent().catch(() => null); 
      const company1 = await pageFirst.nth(0).locator('h2 + span').textContent().catch(() => null); 
      results.push({ page: 1, person: person1?.trim() || null, company: company1?.trim() || null });

      console.log('1st record:',JSON.stringify(results, null, 2));

      await page.waitForTimeout(324);

      
      // Page 2
      //await page.locator(this.SEL_NEXT).click();
      // Get the bounding box of the element. It returns null if the element is not visible.
      const cordinates = await page.locator(this.SEL_NEXT).boundingBox();

      if(cordinates){
        await page.mouse.wheel(0, -400);
        await page.mouse.move(cordinates.x, cordinates.y);
        await page.locator(this.SEL_NEXT).hover();
        await page.locator(this.SEL_NEXT).click();
        
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        await page.mouse.wheel(0, 30);
        await page.mouse.wheel(0, 70);

        // Page 2 record 2
      const pageTwo = page.locator(this.SEL_ITEM_LINK); 
      const person2 = await pageTwo.nth(1).locator('h2').textContent().catch(() => null); 
      const company2 = await pageTwo.nth(1).locator('h2 + span').textContent().catch(() => null); 
        results.push({ page: 2, person: person2?.trim() || null, company: company2?.trim() || null });
      }
      
      this.log.info({ total: results.length }, 'crawlManual finished');
      console.log('crawlManual results:',JSON.stringify(results, null, 2));
      
      await browser.close();
      
      return results;
    } catch (err) {
      console.error('crawlManual error:', err);
      return null;
    } finally {
      // do not close browser (that would kill your manual window)
      if (browser) await browser.close();
    }
    
  }

  public async crawlPersistent(startUrl: string): Promise<any>{
    const sessionId = format(new Date(), 'yyyyMMddhhmmssaa');

    const contextHarFile = path.join(this.conf.playwrightHarDirPath, `zillow.${sessionId}.har`);
    const traceZipFile   = path.join(this.conf.playwrightTraceDirPath, `zillow.${sessionId}.zip`);

    // create result storage
    const results: { page: number; person: string | null; company: string | null, zurl: string | null, webiste: string | null }[] = [];

    const browser: Browser = await chromium.launch({
      timeout: this.conf.scraperTimeoutMs,
      headless: this.conf.playwrightHeadless,
      slowMo: randomInt(this.conf.playwrightSlowmoMs, (this.conf.playwrightSlowmoMs+950)),
      executablePath: this.conf.playwrightBrowser,
      devtools: this.conf.playwrightDevtools,
      proxy: {server: `socks5://192.252.214.17:4145`},
      downloadsPath: this.conf.downloadDirPath,
      tracesDir: this.conf.playwrightTraceDirPath,
      ignoreDefaultArgs: ['--enable-automation'],  
      args: [
        '--disable-infobars',
        //'--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox', 
        '--disable-setuid-sandbox'
      ],
    });

    const context = await browser.newContext({
      //viewport: null,
      userAgent: this.conf.playwrightUaSource,
      locale: 'en-US',
      recordHar: {
        path: contextHarFile,
      },
      recordVideo: {
         dir: this.conf.playwrightVideoDirPath,
      },
    });

    /*
    const contextP = await chromium.launchPersistentContext(
      path.join(this.conf.playwrightPersistentDirPath, sessionId), {
      headless: false,
      devtools: false,
      slowMo: 400,
      executablePath: this.conf.playwrightBrowser,
      proxy: {server: `socks5://38.127.172.95:46656`},
      locale: 'en-US',
      userAgent: this.conf.playwrightUaSource,
      recordHar: {
        path: this.conf.playwrightHarDirPath
      },
      recordVideo: {
        dir: this.conf.playwrightVideoDirPath,
      },
      ignoreDefaultArgs: ['--enable-automation'],  
      args: [
        '--disable-infobars',
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox', 
        '--disable-setuid-sandbox'
      ], // for args visit: https://peter.sh/experiments/chromium-command-line-switches/
    });
    */

    // 🔴 tracing is NOT automatic: you must start it
    await context.tracing.start({
      title: `zillow-${sessionId}`,
      screenshots: true,
      snapshots: true,
      sources: true,
    });

    const page = await context.newPage();
    
    try {
      // open the url
      await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(randomInt(500, 1200));
      await page.mouse.wheel(0, 56);

      // count the results on page
      let hasNextPage = await page.locator(this.SEL_NEXT_ENABLED).first().count();
      let currentPage = 1;
      
      do {
        const items = page.locator(this.SEL_ITEM_LINK);
        const count = 2; //await items.count();

        for (let i = 0; i < count; i++){
          const card = items.nth(i);
          await card.scrollIntoViewIfNeeded();

          const person = await card.locator('h2').textContent().catch(() => null); 
          
          let company: string | null = null;
          /*const compSrc = card.locator(':scope > div:has(> h2) + span');
          const compTeamSrc = card.locator(':scope > h2 + span');
          if (await compSrc.count()) {
            company = await compSrc.first().textContent().catch(() => null);
          } else if (await compTeamSrc.count()) {
            company = await compTeamSrc.first().textContent().catch(() => null);
          }*/

          const compSrc = card.locator('div:has(> h2) + span');
          const compTeamSrc = card.locator('h2 + span');
          if(await compSrc.count() === 1){
            company = await compSrc.first().textContent().catch(() => null);   
          } else if(await compTeamSrc.count() === 1){
            company = await compTeamSrc.first().textContent().catch(() => null);
          }
          

          /*
          let company = await items.nth(i).locator('div:has(> h2) + span').textContent().catch(() => null); 
          if(company == null){
            company = await items.nth(i).locator('h2 + span').textContent().catch(() => null);
          }
          */

          // click on listing and get the webiste url from detailed page
          console.log(`Going to get webiste url for record ${i + 1}`);
          let zurl: string | null = null;
          zurl = await card.getAttribute('href');  

          await card.click({ delay: 120 });
          await page.waitForLoadState('domcontentloaded');

          let webiste: string | null = null;
          const aTag = page.locator(this.SEL_WEBSITE);
          if(await aTag.count()){
            await aTag.scrollIntoViewIfNeeded();
            webiste = await aTag.getAttribute('href');  
          }

          results.push({ page: Number(`${currentPage}.${i + 1}`), person: person?.trim() || null, company: company?.trim() || null, zurl: zurl?.trim() || null, webiste: webiste?.trim() || null });  
          
          // await the scrolling to the top
          await page.mouse.wheel(0, 0);

          await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {
            console.log('⚠️  Go Back() did not trigger navigation, falling back to selector wait');
          });
          await page.waitForSelector(this.SEL_ITEM_LINK, { state: 'visible', timeout: 10000 });
          
          console.log(`Finished: Page: ${currentPage} | record: ${i + 1}`);
        }

        const nextBtn = page.locator(this.SEL_NEXT_ENABLED);
        hasNextPage = await nextBtn.first().count();
        console.log(`Moving for next page: ${hasNextPage}`);

        // Get the x and y position of next page button. It returns null if the element is not visible.
        const cordinates = await nextBtn.boundingBox();
        if(hasNextPage === 1 && cordinates){
          console.log(`Going to next page...`);

          //await page.mouse.wheel(cordinates.x, cordinates.y);
          await nextBtn.scrollIntoViewIfNeeded();
          await page.mouse.move(cordinates.x, cordinates.y);
          await nextBtn.hover();
          await nextBtn.click({ delay: 140 });
          
          // update currect page number and we nevigated to location
          currentPage++;
          console.log(`new current page ${currentPage}`)
          if(currentPage == 3) {hasNextPage = 0;} // for temp test purpose
          console.log(`after new currect page; next page is ${hasNextPage}`)

          await page.waitForLoadState('domcontentloaded').catch(() => null);
          await page.mouse.wheel(0, 56);
        } else {
          console.log(`Next page is not availabe...`);
        }
      } while (hasNextPage === 1);
      
      this.log.info({ total: results.length }, 'crawlPersistent finished');
      console.log('crawlPersistent results:',JSON.stringify(results, null, 2));
    } catch (err) {
      console.error('crawlPersistent error:', err);
      return null;
    } finally {
      
      // 🟢 stop tracing BEFORE closing the context so it actually writes the .zip
      await context.tracing.stop({ path: traceZipFile }).catch(() => {});

      await context.close(); //.catch(() => {});
      await browser.close(); //.catch(() => {});

      console.error('crawlPersistent finished finally');

      return results;
      
    }
  }
}



/*
okay here are the selectores.
in programing code I need all these to be saved in classs variable and after use it so become easy for mantainance

there a url given and url as listings and we need to crawle below
it possible that given selecter element is not exist in dom if information is not availabe in that case skip it

STAGE 1
scroll bit down and bring listing at top of screen
behave like human 

single listing (formally lets call it - card) selector
a[class^="StyledCard-"][role="link"]
need to count and loop though and use .nth() to make it more accurate

inside card there is name of the person and selector tag is
h2 => u_fname

inside card there is name of the company 
there are 2 use case to get company name need to try both because html is uncertain
case 1.
span
this tag selector is after h2 tag kind of h2+span
case 2.
span
this tag selector is after div tag which has h1 tag inside
kind of div:has(> h2) + span 
=> busns_name

STAGE 2
PAGINATION PROCESS
next page button selector
nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:last-child button

if this button is disabled then there attribute on buttoon
[aria-disabled="true"]
if this button is active then there attribute on buttoon
[aria-disabled="false"]
If next button is disabled then there is no next page, means pagination is over

previous page button selector
nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:first-child button

if this button is disabled then there attribute on buttoon
[aria-disabled="true"]
if this button is active then there attribute on buttoon
[aria-disabled="false"]

get current page number
nav ul[class^="PaginationList-"] li[class^="PaginationNumberItem-"][aria-current="page"] button
get the text of button which is number or
get [title] attribute value which is string

card also has [href] attribute which is url
get it and save it as zuser_url
keep going with scrolling as we go ahed with listing 
before click on listing card make sure scroll to the card
like: await card.scrollIntoViewIfNeeded();

STAGE 3
Now, click on card it will load new detail page
click on single listing selector and wait until load and need to capture below details

first need to get state and city selector
nav[aria-label="Breadcrumb"] ol
inside 1st li it's state
li:first-child => uaddr_state_id
iniside 2nd li it's city 
li:second-child => uaddr_city_id

STAGE 4
there is a section and its selector is
section#get-to-know-me 
first scroll to this section 

now, inside that section there is a tags and selectors are as below
a[class^="StyledTextButton-"] => upinfo_website_url
get the attribute [href] value to get webiste url
inisde same section another a tag and selector is
a[href*="facebook"] => upinfo_facebook_profile
this is facebook url and get it
inisde same section another a tag and selector is
a[href*="linkedin"] => upinfo_linkedin_profile
this is linkedin url and get it

STAGE 5
now scroll to the section with selector
section[id="reviews"]

STAGE 6
wait and again scroll to the selector
div[class^="ProfileFooter_"]
inisde this div there are 2 child div inisde div and selector is
div div

inside that inner 2nd div there are 3 child div 
get text of 2nd div
div:nth-child(2) => lead_initial_findings
we need to go in 3d child
div:nth-child(3)
inisde it there another div and selector is 
div
inside this div there are 4 child div which as below detials and need to scrape
div:nth-child(1) => u_primary_mobile
inside a tag and inside a there is a span tag has icon
we need to get text of a tag
div:nth-child(2) => u_whatsapp
inside a tag and inside a there is a span tag has icon
we need to get text of a tag
div:nth-child(3) => u_pemail_verified
inside a tag and inside a there is a span tag has icon
we need to get text of a tag
div:nth-child(4) => uaddr_address
inside a tag and inside a there is a span tag has icon
we need to get text of a tag
it is possible that any of div is absent so as per data need to identify which data it is there
mobile has format:  (803) 837-0958 remove sapce and characotr and after save
email has patter something@domain.com remove space
address is sting
if only 1 mobile number found then save it as u_primary_mobile

STAGE 7
onece all data gathered 
go back 
now click on next listing and repeate the process 

STAGE 8
if all listing on page finished 
click on next page
and repeate the process until all pages get scraped

STAGE 9
create a json and show in console

STAGE 10
create new service 
ScraperService
and new method 
  public async humanCrawl(startUrl: string): Promise<ScrapedRow[]> {
    
  }

  export type ScrapedRow = {
    listIndex: number;
    zuser_url: string;
    u_fname
    busns_name
    u_primary_mobile: string;
    u_whatsapp: string;
    u_primary_email: string;
    uaddr_address: string;
    uaddr_state_id: string;
    uaddr_city_id: string;
    upinfo_website_url: string;
    upinfo_facebook_profile: string;
    upinfo_linkedin_profile: string;
    lead_initial_findings: string;
    lead_created: date time current
    lead_stage: 1 (just a static value)
};

take all selectors as class variables
such as 
private readonly SEL_* = '';











==========


pagination page number selector
nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"] button

currect page selector
nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"] [aria-current="page"] button

previous page selector
nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:first-child button

check if previous page is enabled
nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:first-child button[aria-disabled="false"]

check if previous page is disabled
nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:first-child button[aria-disabled="true"]

next page selector
nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:last-child button

check if next page is enabled
nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:last-child button[aria-disabled="false"]

check if next page is disabled
nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:last-child button[aria-disabled="true"]


click on single listing selector and wait until load and need to capture below details
if it possible that element is not exist in dom if information is not availabe in that case skip it

get webiste url
section#get-to-know-me a[class^="StyledTextButton-"]

get facebook url
section#get-to-know-me a[href*="facebook"]

now go return and do the same for next listing card and repeat until pagination finish
at this moment only scrap 2 listing card on page 1 only for testing 
means impement entire pagination logic but stop when 2 listing card is done.

whether pagination reach end or not need to check if next page buttin is disabled or not using selector
i suggest you to click on next and previous button only for one by one page naviration

create the json and return from the function and show in console
using workerBootstrap to run the app


# Start Chrome with remote-debugging
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/Users/core/Development/nodejs/scraper.thatsend.work_web/assets/tmp/persistent

*/