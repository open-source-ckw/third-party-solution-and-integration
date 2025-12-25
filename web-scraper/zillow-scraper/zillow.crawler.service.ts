/*
AI GENERATED FILE
PROMPT

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
=> ucorp_company_name

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
    ucorp_company_name
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
*/

/*
Create new crawler method which can do below

public async humanSearchCrawl(startUrl: string) {
}

1. open browser and go to startUrl 
2. Wait for the page to load
3. Scroll slowly to bottom at the end of page
4. now scroll up slowly and come to the top
5. Hover on a menu
selector: ui[data-zg-section="main"] > li:nth-child(5)
6. mega menu will open 
selector: div[data-zg-role="drop-down-content"]
7. Inside there a link click an wait until load
selector: data-za-action="Real estate agents"
8. new page will have seach box, option to choose and search button
choose option by clicking on
selector: div[aria-label="Search button group"] > button[value="location"]
type in text box, take value from static variable
seach box selector: input:[id][enterkeyhint="search"]
as you type it will show suggestions, you type untill you finish the whole word
once you finish chicl on 1st suggestion
selector: select[role="presentation"] ul[aria-activedescendant] li:first-child
now wait until page load

*/

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

import { ConfService, LibraryAppService, LogService, WebCrawlerService } from '@libs/library-app';
import { Injectable, Logger } from '@nestjs/common';
import type { Page, BrowserContext, Locator } from 'playwright';
import { CrawlerLeadService, ZillowCrawlerScrapedRow } from '@libs/dynamic-app';
import { PlaywrightHuman } from '@libs/library-app/web-crawler/playwright/playwright.human';


@Injectable()
export class ZillowCrawlerService {
    // scrap through 2 listing per page and 2 pages in total
    private readonly trial: boolean = true;
    private readonly domain: string = 'https://www.zillow.com';
  
    // ======================
    // SELECTORS search process
    // ======================
    // main menu item
    private readonly SEL_MENU_ITEM_PRIMARY   = 'ul[data-zg-section="main"] > li:nth-child(5) > a';
    
    // search bar on the new page
    private readonly SEL_SEARCH_GROUP   = 'div[aria-label="Search button group"]';
    private readonly SEL_BTN_LOCATION   = 'div[aria-label="Search button group"] > button[value="location"]';
    private readonly SEL_SEARCH_INPUT   = 'input[id][enterkeyhint="search"]';

    // Suggestions (cover a few possible wrappers)
    private readonly SEL_SUGGEST_FIRST  = 'section[role="presentation"] ul[aria-activedescendant] li:first-child';

    // Default search query (override via method parameter if you want)
    private readonly DEFAULT_LOCATION_QUERY = 'Orangeburg, SC';
    
    // ======================
    // SELECTORS listinig crawling
    // ======================
  
    // STAGE 1: listing cards
    private readonly SEL_CARDS = 'a[class^="StyledCard-"][role="link"]';
    private readonly SEL_CARD_NAME = 'h2'; // u_fname
    private readonly SEL_COMPANY_AFTER_H2 = 'h2 + span'; // ucorp_company_name (case 1)
    private readonly SEL_COMPANY_DIV_H2_PLUS_SPAN = 'div:has(> h2) + span'; // ucorp_company_name (case 2)
  
    // STAGE 2: pagination
    private readonly SEL_PAGINATION_NEXT_BTN =
      'nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:last-child button';
    private readonly SEL_PAGINATION_PREV_BTN =
      'nav ul[class^="PaginationList-"] li[class^="PaginationJumpItem-"]:first-child button';
    private readonly SEL_PAGINATION_CURR_BTN =
      'nav ul[class^="PaginationList-"] li[class^="PaginationNumberItem-"][aria-current="page"] button';
  
    // STAGE 3: detail breadcrumb (state, city)
    private readonly SEL_BREADCRUMB_OL = 'nav[aria-label="Breadcrumb"] ol';
    private readonly SEL_BC_STATE = 'li:first-child';
    private readonly SEL_BC_CITY = 'li:first-child + li';
  
    // STAGE 4: "get to know me" section + socials
    private readonly SEL_SEC_GETTOKNOW = 'section#get-to-know-me';
    private readonly SEL_SHOW_MORE_BTN = 'div[class^="GetToKnowMe__StyledLinkContainer-"] div button';
    private readonly SEL_WEBSITE_BTN = 'a[class^="StyledTextButton-"]';
    private readonly SEL_FACEBOOK = 'a[href*="facebook.com"]';
    private readonly SEL_LINKEDIN = 'a[href*="linkedin.com"]';
    private readonly SEL_X = 'a[href*="twitter.com"], a[href*="x.com"]';
    private readonly SEL_INSTAGRAM = 'a[href*="instagram.com"]';
    private readonly SEL_TIKTOK = 'a[href*="tiktok.com"]';
  
    // STAGE 5: reviews section
    private readonly SEL_SEC_REVIEWS = 'section#reviews';
  
    // STAGE 6: footer/contact block
    private readonly SEL_PROFILE_FOOTER = 'div[class^="ProfileFooter_"]';
    private readonly SEL_PROFILE_FOOTER_2DIVS = 'div[class^="PageBodyWrapper_"] div'; // two child divs
    private readonly SEL_FINDINGS_TEXT = `div[class^="ProfileFooter__"] > div > div > div:nth-child(2)`;
    private readonly SEL_CONTACT_CONTAINER = `div[class^="ProfileFooter__"] > div > div > div:nth-child(3)`;
    private readonly SEL_CONTACT_ITEM_A = (n: number) => `div:nth-child(${n}) a`; // get text of <a>

    
    
    constructor(
        private readonly conf: ConfService,
        private readonly log: LogService,
        private readonly libraryAppService: LibraryAppService,

        private readonly crawler: WebCrawlerService,
        private readonly crawlerLeadService: CrawlerLeadService,
    ) {
        this.log.setContext(ZillowCrawlerService.name);
    }

    public async humanCrawl(): Promise<void> {
      let rows: ZillowCrawlerScrapedRow[] = [];

      const sessionId = 'zillow-crawler';
      const keepAliveMs = 15 * 60_000; // close-only after idle, keep profile on disk

      await this.crawler.withHumanPagePersistent(sessionId, async (page, _ctx, H) => {
        // load the main site to start crawling
        await H.openForever(this.domain, 'body', { deadlineMs: 60_000 });
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await H.sometimesPause(1, [4000, 7000]);
        console.log(`Browser opened and url loaded`);

        // get the search keyword from api
        const searchKw = this.DEFAULT_LOCATION_QUERY;

        // search as per given keyword to find agents
        await this.searchHumanCrawlerProcess(page, _ctx, H, searchKw);

        // as page is loaded start crawling the agent data run the scraper
        rows = await this.listingHumanCrawlProcess(page, _ctx, H);
        
      }, { url: this.domain, label: 'humanCrawler', headed: true}, undefined, keepAliveMs);

      // API call: upsert rows in DB
      /*if(rows.length > 0){
        const resp = await this.crawlerLeadService.zillowCrawlerLeadUpsert(rows);
        console.log(`Upsert status`);
        console.log(JSON.stringify(resp, null, 2));
      }*/
      console.log(rows);
    }
  
    /**
     * SEARCH
     **/
    /**
     * 2nd scraper main flow
     * 1) open startUrl
     * 2) wait for page load
     * 3) slow scroll to bottom
     * 4) slow scroll to top
     * 5) hover 5th menu item -> open mega menu
     * 6) click "Real estate agents"
     * 7/8) choose "location", type query, pick first suggestion, wait for load
     */
    public async searchHumanCrawlerProcess(page: Page, ctx: BrowserContext, H: PlaywrightHuman, locationQuery: string): Promise<void> {
        // 3) scroll slowly to bottom
        await H.smoothScrollToBottom(1000);
        // 4) then back up slowly to top
        await H.smoothScrollToTop();
        console.log(`Scroll performed`);

        // 5) hover on the 5th menu item (robust selection)
        const menuItem = page.locator(this.SEL_MENU_ITEM_PRIMARY);
        await H.clickAndWaitVisibleForever(menuItem, this.SEL_SEARCH_GROUP, { deadlineMs: 30_000, hover: true });
        console.log(`Clicked on agent menue and wait until load`);
        await page.waitForLoadState('domcontentloaded').catch(() => {});

        // 6) choose "location" option
        const btnLocation = page.locator(this.SEL_BTN_LOCATION).first();
        if (await btnLocation.count()) {
          await btnLocation.click().catch(() => {});
        }
        console.log(`Selected the option to search with location`);

        // 7) type into search box (human-ish)
        const input = page.locator(this.SEL_SEARCH_INPUT).first();
        await input.click({ force: true }).catch(() => {});
        // need to type slow so suggestion can open
        await H.typing(input, locationQuery, { 
          clearFirst: true, 
          delayRange: [90, 150],
          typos: true,  
          burstChance: 0.3,
          burstLenRange: [3, 5]
        }).catch(() => {});
        console.log(`Entered search keyword`);

        // after typing into the input let suggestions render (short, human-like dwell)
        await H.sometimesPause(1, [1200, 2200]);

        // try to detect suggestions but do not fail hard if they don't appear
        const firstSuggestion = page.locator(this.SEL_SUGGEST_FIRST).first();
        const sawSuggestions = await H.visibleForever(firstSuggestion, { deadlineMs: 8000, throwOnTimeout: false });

        if (sawSuggestions) {
          // highlight first suggestion then submit
          await input.press('ArrowDown').catch(() => {});
          await input.press('Enter').catch(async () => { await page.keyboard.press('Enter').catch(() => {}); });
        } else {
          // fallback: submit search directly
          await input.press('Enter').catch(async () => { await page.keyboard.press('Enter').catch(() => {}); });
        }
        console.log(`Search requested`);

        // wait until url updates to professionals search result page (do not throw)
        await page.waitForURL(/\/professionals(?:\/|\?|#|$)/, { timeout: 30000 }).catch(() => {});
        console.log(`Url updated for search result page`);

        // optional: small settle + a small scroll to look human
        await H.sometimesPause(0.99, [10000, 15000]);
        console.log(`Going to visit the whole page`);
        await H.smoothScrollToBottom();
        await H.smoothScrollToTop();
        console.log(`Process acomplished`);
    }
    public async searchHumanCrawleTrial(startUrl: string, locationQuery = this.DEFAULT_LOCATION_QUERY): Promise<void> {
      await this.crawler.withHumanPage(async (page, _ctx, H) => {
        // 1–2) open & settle
        await H.openForever(startUrl, 'body', { deadlineMs: 60_000 });
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        console.log(`Browser opened and url loaded`);

        // 3–8) main flow
        await this.searchHumanCrawlerProcess(page, _ctx, H, this.DEFAULT_LOCATION_QUERY);

      }, { url: startUrl, label: 'searchHumanCrawler' });
    }

    /**
     * LISTING
     **/
    public async listingHumanCrawlProcess(page: Page, ctx: BrowserContext, H: PlaywrightHuman): Promise<ZillowCrawlerScrapedRow[]> {

        const rows: ZillowCrawlerScrapedRow[] = [];

        // check for px press-hold human verification
        await H.trySolvePxPressHold().catch(() => {});

        await H.smoothScrollToBottom(400);
  
        let pageIndex = 1;
        let hasNextPage = 1; // 1 = keep going, 0 = stop
  
        console.log(`Starting processing`);
        // --- process current page ---
        nextPageWhile: while (hasNextPage === 1) {
          await H.smoothScrollToBottom(300);
  
          // (optional) current page number (for logs)
          const currentPageText = await this.textOrAttr(
            page.locator(this.SEL_PAGINATION_CURR_BTN),
            'text'
          );

          console.log(`TOP Processing page: index ${pageIndex} vs browser ${currentPageText}`);
          this.log.debug(`TOP Processing page: index ${pageIndex} vs browser ${currentPageText}`);

          // cross check with browser current page number and pageIndex counter
          if(pageIndex !== Number(currentPageText)) {
            console.log(`Page mistach index vs browser`); 
            console.log(`Page mistach index vs browser`); 
          }
  
          // Cards on this page
          const cards = page.locator(this.SEL_CARDS);
          const total = this.trial ? 2 : await cards.count(); // for testing purpose scrap 1 card per page
  
          listingOnPageLoop: for (let i = 0; i < total; i++) {
            console.log(`Starting card ${i}`);

            const card = cards.nth(i);
            await card.scrollIntoViewIfNeeded();
            await H.sometimesPause();
  
            const zuser_url = await card.getAttribute('href').catch(() => null);
            const fullName = await this.textSafe(card.locator(this.SEL_CARD_NAME));

            // check full name is a real person or any organization, company etc name
            const determinedAs = this.libraryAppService.determineNameType(fullName);
            const eMsg = `Lead determined as: ${determinedAs} - Card: ${fullName}.`; 
            console.log(eMsg); this.log.debug(eMsg);
              
            const ucorp_company_name = await this.pickFirst(
              () => this.textSafe(card.locator(this.SEL_COMPANY_AFTER_H2)),
              () => this.textSafe(card.locator(this.SEL_COMPANY_DIV_H2_PLUS_SPAN)),
            );
            console.log(`Card: ${fullName} | ${ucorp_company_name}`);

            // STAGE 3: breadcrumb state/city
            const bc = page.locator(this.SEL_BREADCRUMB_OL);

            // click on card to open card detail 
            console.log(`Clicking on card for more detials`);
            //await H.safeClickNav(card, 'domcontentloaded');
            await H.clickAndWaitVisibleForever(card, bc);
            await H.sometimesPause(0.95, [1500, 2500]);

            // check for px press-hold human verification
            await H.trySolvePxPressHold().catch(() => {});

            const uaddr_state = await this.textSafe(bc.locator(this.SEL_BC_STATE));
            const uaddr_city = await this.textSafe(bc.locator(this.SEL_BC_CITY));
            console.log(`${uaddr_state}, ${uaddr_city}`);

            // STAGE 4: get-to-know-me + socials
            let upinfo_website_url: string | null = null;
            let upinfo_facebook_profile: string | null = null;
            let upinfo_linkedin_profile: string | null = null;
            let upinfo_x_profile: string | null = null;
            let upinfo_instagram_profile: string | null = null;
            let upinfo_tiktok_profile: string | null = null;
  
            const getToKnow = page.locator(this.SEL_SEC_GETTOKNOW);
            await getToKnow.scrollIntoViewIfNeeded();
            await H.sometimesPause(0.95, [200, 500]);

            if (await getToKnow.count()) {
              await H.scrollIntoView(getToKnow);
              
              // pretend like we are human so click on read more to have artical open
              const showMore = getToKnow.locator(this.SEL_SHOW_MORE_BTN);
              if(await showMore.count()){
                await H.safeClickNav(showMore);
                await H.scrollIntoView(showMore);
              }
  
              // get data of socials
              upinfo_website_url = await this.attrSafe(getToKnow.locator(this.SEL_WEBSITE_BTN).first(), 'href');
              upinfo_facebook_profile = await this.attrSafe(getToKnow.locator(this.SEL_FACEBOOK).first(), 'href');
              upinfo_linkedin_profile = await this.attrSafe(getToKnow.locator(this.SEL_LINKEDIN).first(), 'href');
              upinfo_x_profile = await this.attrSafe(getToKnow.locator(this.SEL_X).first(), 'href');
              upinfo_instagram_profile = await this.attrSafe(getToKnow.locator(this.SEL_INSTAGRAM).first(), 'href');
              upinfo_tiktok_profile = await this.attrSafe(getToKnow.locator(this.SEL_TIKTOK).first(), 'href');
            }
            console.log(`Social links captured`);
  
            // STAGE 5: reviews (just scroll there as human)
            const reviews = page.locator(this.SEL_SEC_REVIEWS);
            if (await reviews.count()) {
              await H.scrollIntoView(reviews);
            }
  
            // STAGE 6: footer/contact
            let lead_initial_findings: string | null = null;
            let u_primary_mobile: string | null = null;
            let ucorp_mobile: string | null = null;
            let u_primary_email: string | null = null;
            let uaddr_address: string | null = null;
  
            const footer = page.locator(this.SEL_PROFILE_FOOTER).first();
            if (await footer.count()) {
              await footer.scrollIntoViewIfNeeded();
              await H.sometimesPause();
  
              // the second of two child divs
                const findingsNode = page.locator(this.SEL_FINDINGS_TEXT).first();
                if (await findingsNode.count()) {
                    await findingsNode.scrollIntoViewIfNeeded();
                    await H.sometimesPause();
                    lead_initial_findings = await this.innerTextSafe(findingsNode);
                }
                console.log(`Findings notes completed`);
              // contact container (3rd child)
              const contactContainer = page.locator(this.SEL_CONTACT_CONTAINER).first();
              if (await contactContainer.count()) {
                const count = await contactContainer.locator('div').count();
                for (let k = 1; k <= count; k++) {
                  const a = contactContainer.locator(this.SEL_CONTACT_ITEM_A(k));
                  const raw = (await this.textSafe(a))?.trim() || '';
                  if (!raw) continue;

                  if (!u_primary_email && this.isEmail(raw)) {
                    u_primary_email = this.cleanEmail(raw);
                    continue;
                  }
                  if (this.looksLikePhone(raw)) {
                    const clean = this.cleanPhone(raw);
                    const parentText = (await a.locator('..').textContent().catch(() => ''))?.toLowerCase() || '';
                    if (!ucorp_mobile && /whats\s*app|wa\b/.test(parentText)) {
                      ucorp_mobile = clean;
                    } else if (!u_primary_mobile && u_primary_mobile !== clean) {
                      u_primary_mobile = clean;
                    } else if (!ucorp_mobile && u_primary_mobile !== clean) {
                      ucorp_mobile = clean;
                    }
                    continue;
                  }
                  if (!uaddr_address) {
                    uaddr_address = raw.replace(/\s+/g, ' ').trim();
                  }
                }
              }
              console.log(`Contact info: ${u_primary_mobile}`);
            }

            // set some data in initial_findings
            if (lead_initial_findings) {
              // zillow url
              lead_initial_findings += `Zillow URL: ${zuser_url} | `;

              // set city and state as per search and also sub orginasation name
              lead_initial_findings += `${uaddr_city}, ${uaddr_state}, USA | Powered by: ${ucorp_company_name} | `;

              // set page and record
              lead_initial_findings += `Page: ${pageIndex} | `;
              lead_initial_findings += `Record: ${i + 1} | `;
              lead_initial_findings += `---Zillow Crawler End : ${new Date().toISOString()}---`;
            }

            // parse address
            const parseUsaAddress = this.libraryAppService.parseUsaAddress(uaddr_address);
            
            // set the row
            if(determinedAs === 'organization') {
              rows.push({
                busns_connsrc_id: String(28), // 28 for zillow from work_thatsend_api
                busns_name: fullName,
                busns_address: parseUsaAddress.address || null,
                busns_city: uaddr_city || null,
                busns_state: uaddr_state || null,
                busns_country: 'USA',
                busns_zipcode: parseUsaAddress.zipcode || null,
                busns_toll_free_number: ucorp_mobile || null,
                busns_mobile: u_primary_mobile || null,
                busns_mobile_cc: u_primary_mobile ? String(1) : null,
                busns_email: u_primary_email || null,
                busns_website_url: upinfo_website_url || null,
                busns_linkedin_profile: upinfo_linkedin_profile || null,
                busns_facebook_profile: upinfo_facebook_profile || null,
                busns_instagram_profile: upinfo_instagram_profile || null,
                busns_youtube_profile: null,
                busns_x_profile: upinfo_x_profile || null,
                busns_tiktok_profile: upinfo_tiktok_profile || null,
                busns_pinterest_profile: null,
                
                lead_initial_findings: lead_initial_findings || null,
                lead_created: new Date().toISOString(),
                lead_determined_as: determinedAs,
  
                crawler_stage: 'zillow',
              });

            } else {
              // parse full name
              const parseFullName = this.libraryAppService.parseUsaPersonName(fullName);

              rows.push({
                u_fname: parseFullName.fname || null,
                u_lname: parseFullName.lname || null,
                u_mname: parseFullName.mname || null,
                u_primary_mobile: u_primary_mobile || null,
                u_primary_mobile_cc: u_primary_mobile ? String(1) : null,
                u_whatsapp: null,
                u_whatsapp_cc: null,
                u_primary_email: u_primary_email || null,
                u_connsrc_id: String(28), // 28 for zillow from work_thatsend_api
                
                uaddr_address: null,
                uaddr_state: uaddr_state || null,
                uaddr_city: uaddr_city || null,
                uaddr_country: 'USA',
                uaddr_postal_zip_code: null,
                
                upinfo_website_url: upinfo_website_url || null,
                upinfo_facebook_profile: upinfo_facebook_profile || null,
                upinfo_linkedin_profile: upinfo_linkedin_profile || null,
                upinfo_x_profile: upinfo_x_profile || null,
                upinfo_tiktok_profile: upinfo_tiktok_profile || null,
                upinfo_instagram_profile: upinfo_instagram_profile || null,
                upinfo_youtube_profile: null,
                upinfo_pinterest_profile: null,
                
                ucorp_company_name: ucorp_company_name || null,
                ucorp_email: null,
                ucorp_mobile: ucorp_mobile || null,
                ucorp_mobile_cc: ucorp_mobile ? String(1) : null,
                ucorp_address: parseUsaAddress.address || null,
                ucorp_city: uaddr_city || null,
                ucorp_state: uaddr_state || null,
                ucorp_country: 'USA',
                ucorp_postal_zip_code: parseUsaAddress.zipcode || null,
  
                lead_initial_findings: lead_initial_findings || null,
                lead_created: new Date().toISOString(),
                lead_determined_as: determinedAs,
  
                crawler_stage: 'zillow',
              });
            }
            
            console.log(`Data saved`);
  
            // Back to listings as done with details:
            console.log(`Going back to listing`);
            await page.goBack({ waitUntil: 'domcontentloaded' });
            //await H.backForever(this.SEL_CARDS);

            // check for px press-hold human verification
            await H.trySolvePxPressHold().catch(() => {});
            
            await H.smoothScrollToBottom(300);
            console.log(`Card ${i} finished`);
          }
          console.log(`All cards on page ${pageIndex} finished. Checking for next page...`);
          // --- after finishing this page, decide next step ---
          const nextEnabled = await this.isNextEnabled(page);
          if (!nextEnabled) {
            hasNextPage = 0; // stop
            console.log(`Next page not found, crawl done`);
          } else {
            // click next and continue
            console.log(`Processing for next page`);
            const nextBtn = page.locator(this.SEL_PAGINATION_NEXT_BTN).first();
            const beforeUrl = page.url();
            
            await H.scrollIntoView(nextBtn);
            console.log(`Clicking on next page button`);
            
            // ...after finishing this page’s cards, move to next page:
            //await nextBtn.click(); await page.waitForLoadState('domcontentloaded');
            //await H.clickAndWaitVisibleForever(nextBtn, cards);
            await H.safeClickNav(nextBtn, 'domcontentloaded');

            // check for px press-hold human verification
            await H.trySolvePxPressHold().catch(() => {});
            
            await H.smoothScrollToBottom(300);
            console.log(`Checking next page status`);
            
            // guard: if URL didn’t change AND next now disabled, stop to avoid loop
            const afterUrl = page.url();
            const stillNextEnabled = await this.isNextEnabled(page);
            console.log(`beforeUrl: ${beforeUrl}`); console.log(`afterUrl: ${afterUrl}`);
            
            if (afterUrl === beforeUrl) {
              // if next page is clicked but not loaded some how
              hasNextPage = 0;
              console.log(`ISSUE with NEXT PAGE ${pageIndex + 1} load, STOPPING the scraper...`);
            } else {
              pageIndex++;
              console.log(`Page ${pageIndex} loaded`);

              if(!stillNextEnabled){
                console.log(`Scrapping will complete after page this page ${pageIndex} `);  
              }

              if(this.trial && pageIndex === 3){
                console.log(`For trial purpose scrapping is ending here at page ${pageIndex}`);
                hasNextPage = 0;
              }
            }
          }
        }
  
        // print JSON
        console.log(`Printing out put`);
        console.log(JSON.stringify(rows, null, 2));

        return rows;
    }
    public async listingHumanCrawlTrial(startUrl: string): Promise<ZillowCrawlerScrapedRow[]> {
      const rows: ZillowCrawlerScrapedRow[] = [];

      await this.crawler.withHumanPage(async (page, _ctx, H) => {
        // Go to listings & settle a bit like a human
        await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
        //await H.openForever(startUrl, this.SEL_CARDS);

        // run the scraper
        const rows = await this.listingHumanCrawlProcess(page, _ctx, H);

      }, { 
        url: startUrl, 
        label: 'listingHumanCrawl',
      });

      // API call: upsert rows in DB
      if(rows.length > 0){
        const resp = await this.crawlerLeadService.zillowCrawlerLeadUpsert(rows);
        console.log(`Upsert status`);
        console.log(JSON.stringify(resp, null, 2));
      }
      return rows;
    }
  
    // ======================
    // helpers
    // ======================
  
    // In ScraperService (or wherever you defined it)
    private async isNextEnabled(page: Page): Promise<boolean> {
      try {
        const next = page.locator(this.SEL_PAGINATION_NEXT_BTN).first();

        if ((await next.count().catch(() => 0)) === 0) return false;

        // must be visible and aria-disabled="false"
        const visible = await next.isVisible().catch(() => false);
        if (!visible) return false;

        const aria = (await next.getAttribute('aria-disabled').catch(() => null)) ?? 'true';
        return aria.toLowerCase() === 'false';
      } catch {
        return false;
      }
    }

    private async innerTextSafe(loc: Locator): Promise<string | null> {
        try {
          const handle = await loc.first().elementHandle({ timeout: 3000 });
          if (!handle) return null;
          const txt = await handle.evaluate(el => (el as HTMLElement).innerText || '');
          const clean = txt.replace(/\s+/g, ' ').trim();
          return clean || null;
        } catch {
          return null;
        }
      }
  
    private async textSafe(loc: Locator): Promise<string | null> {
      if (!loc) return null;
      try {
        const t = await loc.first().textContent({ timeout: 3000 });
        return t ? t.replace(/\s+/g, ' ').trim() : null;
      } catch { return null; }
    }
    // replace your attrSafe with this
    private async attrSafe(loc: Locator, attr: string): Promise<string | null> {
      if (!loc) return null;
      try {
        const n = await loc.count();           // <-- 0 = no wait, returns fast
        if (n === 0) return null;
        return await loc.first().getAttribute(attr);
      } catch {
        return null;
      }
    }
  
    private async textOrAttr(loc: Locator, which: 'text' | 'attr', attrName?: string): Promise<string | null> {
      try {
        if (which === 'text') {
          const t = await loc.first().textContent();
          if (t && t.trim()) return t.trim();
        }
        if (attrName) {
          const a = await loc.first().getAttribute(attrName);
          if (a && a.trim()) return a.trim();
        }
        return null;
      } catch {
        return null;
      }
    }
  
    private async pickFirst<T>(...fns: Array<() => Promise<T | null>>): Promise<T | null> {
      for (const fn of fns) {
        try {
          const v = await fn();
          if (v) return v;
        } catch {/* ignore */}
      }
      return null;
    }
  
    private looksLikePhone(s: string): boolean {
      return /[\d\)\(\-\+\s]{8,}/.test(s);
    }
  
    private cleanPhone(s: string): string {
      const digits = (s.match(/\d+/g) || []).join('');
      if (!digits) return '';
      return digits;
    }
  
    private isEmail(s: string): boolean {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
    }
  
    private cleanEmail(s: string): string {
      return s.replace(/\s+/g, '').trim();
    }
  }
