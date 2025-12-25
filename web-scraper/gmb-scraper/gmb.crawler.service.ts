/*
This is a Playwright nodeJS crawler
Need to use Playwright nodejs package
this needs to be in nestJS project
Create New module
GmbCrawlerModule
it's service
Create new crawler method 
class GmbCrawlerService {
    public async gmbHumanCrawler(startUrl: string, locationQuery = this.DEFAULT_LOCATION_QUERY): Promise<void> {
        
    }
}
there is a gmb.crawler.type.ts file for this serive

this service will be similar as our previous seraper.service
ScrapperService
need to use 
PlaywrightModule
PlaywrightService
PlaywrightHuman
same as previous
method will perform below work flow.

It is possible that any of html element or information not availabe in dom and in that case skip that field
take all selectors in class variables
IMP: not a single selector should be used directly

1. open browser and go to startUrl 
2. Wait for the page to load
3. page will have seach box
selector: textarea[aria-label="Search"]
type in text box, take value from static variable
type word like (pick one from list at a time): 
[
  {
    "id": 1,
    "fname": "Matt",
    "lname": "Laricy",
    "fr_user_addresses": [
      {
        "fr_city": {
          "name": "Chicago"
        },
        "fr_state": {
          "name": "Illinois"
        }
      }
    ],
    "fr_user_corporate_infos": {
      "company_name": "Americorp Real Estate"
    }
  },
  {
    "id": 2,
    "fname": "Patrick",
    "lname": "Shino",
    "fr_user_addresses": [
      {
        "fr_city": {
          "name": "Chicago"
        },
        "fr_state": {
          "name": "Illinois"
        }
      }
    ],
    "fr_user_corporate_infos": {
      "company_name": "FULTON GRACE REALTY"
    }
  },
  {
    "id": 3,
    "fname": "Tessa",
    "lname": "Spigner",
    "fr_user_addresses": [
      {
        "fr_city": {
          "name": "Columbia"
        },
        "fr_state": {
          "name": "South Carolina"
        }
      }
    ],
    "fr_user_corporate_infos": {
      "company_name": "Real Estate Associates LLC"
    }
  }
]

4. From above list pick one by one and each will have 3 possibile combination of keyword
kw1. fname + lname + , + fr_business_user.name + , + fr_user_addresses.fr_city.name + , + fr_user_addresses.fr_state.name
kw2. fname + lname + , + fr_user_addresses.fr_city.name + , + fr_user_addresses.fr_state.name
kw1. fr_business_user.name + , + fr_user_addresses.fr_city.name + , + fr_user_addresses.fr_state.name

with each keyword you need to process below steps and find GMB profile
first try with kw1 then if not found then try with kw2 then if not found then try with kw3
with kw3 also not found skip to next record
make sure the priority is kw1 > kw2 > kw3

5. once you finish typing wait for 2 sec and press enter
6. Wait for page load
7. Once new page open check for google my business (GMB) profile element 
selector: div[class="osrp-blk"][id]
8. If element not found then process else goto back and start from step 3 or 4 with new keyword
9. If element found then process as below, find all below information inside GMB element
as found scroll to GMB element
10. take the business name from GMB profile. Get the text of element 
selector:   h2[data-dtype][data-local-attribute][data-attrid][data-ved]
field: busns_name
for eaxample found word is: Laricy Team
11. Now need to match this business name with the given keyword and check whether it matches or not
for eaxmple:
match with keyword: Matt Laricy, Americorp Real Estate
If you find this match is not similar to the given keyword then do not process and goto back and start from step 3 and search with another keyword
Here need to develop some logic to find more similar matches
12. If match found then need to get below information from GMB profile element, so search all below inside it only
13. Get the total google reviews count from below element
selector: div[data-attrid="kc:/collection/knowledge_panels/local_reviewable:star_score"] a[data-fid][role="button"][jsaction] span 
you will get text like: 625 Google reviews
From this text extract only number 625
field: busns_google_reviews
14. Get the business category from below element
selector: div[data-attrid="kc:/local:one line summary"] 
get the text of element 
you will get info as: Real estate agent in Chicago, Illinois
you need to explode string from "in" and take the first part whatever it is
means:  Real estate agent
field: busns_busseccat_id_1
15. find below element
selector: div[data-attrid="kc:/local:unified_actions"]
and need to find below 2 detials inside it
field: busns_website_url
selector: div[ssk="14:0_local_action"] a[href]
get the href value as website url
field: busns_google_my_business_url 
selector: div[ssk="14:4_local_action"]
click on and wait until a popup become visible
if gmb popup element: div[jsname="coyKpc"]
if visible means popup has opened 
inside gmb popup element check for element 
a[jsname][href]
get the href value as gmb url
once done close the popup by clicking on element
selector: div[role="button"][aria-label="Close"]
16. 
field: busns_address
selector: div[data-attrid="kc:/location/location:address"] > div > div > span:nth-child(2) 
get the text of element
17.
field: busns_mobile
selector: div[data-attrid="kc:/local:alt phone"] > div > div > span:nth-child(2) > a > span
get the text of element 
make sure you clean the mobile number +1 - - -, we already have method cleanPhone() use if don't create new method as all thise code will stay in same class
18.
check for element
selector: div[data-attrid="kc:/common/topic:social media presence"]
if found scroll to this element
now check for beelow elements inside it
field: busns_facebook_profile 
selector: a[href*="facebook.com"]
field: busns_linkedin_profile 
selector: a[href*="linkedin.com"]
field: busns_instagram_profile 
selector: a[href*="instagram.com"]
field: busns_youtube_profile 
selector: a[href*="youtube.com"]
field: busns_x_profile 
selector: a[href*="x.com"], a[href*="twitter.com"]
field: busns_tiktok_profile 
selector: a[href*="tiktok.com"]
field: busns_pinterest_profile 
selector: a[href*="pinterest.com"]
19.
now scroll to top and check for element
selector: div[id="media_result_group"] div[class="kno-fb-ctx"] a[href*="/map/place/"] 
if found then click on and wait until page load
waite until element to visible 
selector: button[aria-label="Share"][data-value="Share"][jsaction][jslog]
if found click on it and wait until popup open and wait to element visible
selector: input[value^="https://maps.app.goo.gl/"]
if found then get the value attribute of element
field: busns_google_map_url
once done click on element
selector:  button[aria-label="Close"][jsaction="modal.close"] span[class="google-symbols"]
20.
Once clicked go back and wait until document load
21. Now need to save in json object/array
22. Again go back to main search page where need to repeate the process with new keyword
23. Once all the records processed then print the json and close the browser
*/

// web-crawler/gmb.crawler.service.ts
import { Injectable } from '@nestjs/common';
import type { Locator, Page } from 'playwright';
import type { Attempt, GmbInputRecord, GmbScrapedRow } from './gmb.crawler.type';
import { ConfService, LibraryAppService, LogService, WebCrawlerService } from '@libs/library-app';
import { ThatsendApiService } from '@libs/dynamic-app';

@Injectable()
export class GmbCrawlerService {
  // ===== Selectors (ALL usage goes through these constants) =====

  // Search page
  private readonly SEL_SEARCH_TEXTAREA = 'textarea[aria-label="Search"]';

  // GMB (knowledge panel) container
  private readonly SEL_GMB_CONTAINER = 'div[id="rhs"]'; 
  /*[
    'div.osrp-blk[id]',
    'div[id="rhs"]'
  ].join(',');*/

  // Business name (inside GMB)
  private readonly SEL_GMB_BUSINESS_NAME = [
    'h2[data-dtype][data-local-attribute][data-attrid][data-ved]',
    'div[data-attrid="title"][role="heading"]'
    ].join(',');
  

  // Reviews (inside GMB)
  private readonly SEL_GMB_REVIEWS = [
    'div[data-attrid="kc:/collection/knowledge_panels/local_reviewable:star_score"] a[data-fid][role="button"][jsaction] span',
    'div[data-attrid="subtitle"] span:nth-child(3) a[data-fid][role="button"][jsaction] span'
    ].join(',');

  // Category (inside GMB) -> split text before " in "
  private readonly SEL_GMB_CATEGORY = [
    'div[data-attrid="kc:/local:one line summary"]',
    'div[data-attrid="subtitle"] span:nth-of-type(4)'
  ].join(',');

  // Unified actions container + items
  private readonly SEL_GMB_ACTIONS = [
    'div[data-attrid="kc:/local:unified_actions"]'
  ].join(',');
  private readonly SEL_GMB_WEBSITE = [
    'div[ssk$="_local_action"] a[href][ping]'
  ].join(',');
  private readonly SEL_GMB_BUSINESS_LINK = [
    'div[ssk$="_local_action"] span[aria-label="Share"]'
  ].join(',');
  private readonly SEL_GMB_POPUP = [
    'div[jsname="coyKpc"]'
  ].join(',');
  private readonly SEL_GMB_POPUP_LINK = [
    'a[jsname][href]'
  ].join(',');
  private readonly SEL_GMB_POPUP_CLOSE = [
    'div.isOpen[role="dialog"] div[role="button"][aria-label="Close"] span[jsslot] span.exportIcon' // span[class="exportIcon"]
  ].join(',');

  // Address / Phone
  private readonly SEL_GMB_ADDRESS = 'div[data-attrid="kc:/location/location:address"] > div > div > span:nth-child(2)';
  private readonly SEL_GMB_ALT_PHONE = 'div[data-attrid="kc:/local:alt phone"] > div > div > span:nth-child(2)';

  // Social presence
  private readonly SEL_GMB_SOCIAL_SECTION = 'div[data-attrid="kc:/common/topic:social media presence"]';
  private readonly SEL_SOC_FB = 'a[href*="facebook.com"]';
  private readonly SEL_SOC_LI = 'a[href*="linkedin.com"]';
  private readonly SEL_SOC_IG = 'a[href*="instagram.com"]';
  private readonly SEL_SOC_YT = 'a[href*="youtube.com"]';
  private readonly SEL_SOC_X  = [
    'a[href*="x.com"]', 
    'a[href*="twitter.com"]'
  ].join(',');
  private readonly SEL_SOC_TT = 'a[href*="tiktok.com"]';
  private readonly SEL_SOC_PI = 'a[href*="pinterest.com"]';

  // Map share
  private readonly SEL_GMB_MAP_ENTRY = 'div[id="media_result_group"] div[class="kno-fb-ctx"][data-local-attribute] a[data-url^="/maps/place/"][ping]';
  private readonly SEL_MAP_SHARE_BTN = 'button[aria-label="Share"][data-value="Share"][jsaction][jslog]';
  private readonly SEL_MAP_SHARE_INPUT = 'input[value^="https://maps.app.goo.gl/"]';
  private readonly SEL_MAP_CLOSE = 'button[aria-label="Close"][jsaction="modal.close"] span.google-symbols';

  // ===== Defaults / data =====

  // Demo static list from your spec (you can inject/replace this)
  private readonly DEFAULT_PEOPLE: GmbInputRecord[] = [
    {
      id: 1,
      fname: 'Matt',
      lname: 'Laricy',
      fr_user_addresses: [{ fr_city: { name: 'Chicago' }, fr_state: { name: 'Illinois' } }],
      fr_user_corporate_infos: { company_name: 'Americorp Real Estate' },
    },
    {
        id: 2,
        fname: 'Karen',
        lname: 'Choe',
        fr_user_addresses: [{ fr_city: { name: 'Columbia' }, fr_state: { name: 'South Carolina' } }],
        fr_user_corporate_infos: { company_name: 'Eastwood homes' },
      },
    {
      id: 3,
      fname: 'Patrick',
      lname: 'Shino',
      fr_user_addresses: [{ fr_city: { name: 'Chicago' }, fr_state: { name: 'Illinois' } }],
      fr_user_corporate_infos: { company_name: 'FULTON GRACE REALTY' },
    },
    {
        id: 4,
        fname: 'Linda',
        lname: 'Fischer',
        fr_user_addresses: [{ fr_city: { name: 'Orangeburg' }, fr_state: { name: 'South Carolina' } }],
        fr_user_corporate_infos: { company_name: 'TruHome Realty' },
    },
    {
      id: 5,
      fname: 'Tessa',
      lname: 'Spigner',
      fr_user_addresses: [{ fr_city: { name: 'Columbia' }, fr_state: { name: 'South Carolina' } }],
      fr_user_corporate_infos: { company_name: 'Real Estate Associates LLC' },
    },
    {
        id: 6,
        fname: 'Jeff',
        lname: 'Lawler',
        fr_user_addresses: [{ fr_city: { name: 'Columbia' }, fr_state: { name: 'South Carolina' } }],
        fr_user_corporate_infos: { company_name: 'Jeff Lawler, REALTOR' },
      },
      {
        id: 7,
        fname: 'Leverage',
        lname: 'Group',
        fr_user_addresses: [{ fr_city: { name: 'Orangeburg' }, fr_state: { name: 'South Carolina' } }],
        fr_user_corporate_infos: { company_name: 'KW Palmetto' },
      }
  ];

  constructor(
        private readonly log: LogService,
        private readonly conf: ConfService,
        private readonly libraryAppService:  LibraryAppService,
        private readonly crawler: WebCrawlerService,
        private readonly tatsendWorkService: ThatsendApiService
    ) {}

  // ===== Public API =====
  public async gmbHumanCrawler(startUrl: string, records: GmbInputRecord[] = this.DEFAULT_PEOPLE): Promise<GmbScrapedRow[]> {

    const rows: GmbScrapedRow[] = [];
    
    /*
    const resp = await this.tatsendWorkService.helloGraph();
    console.log(resp);
    return rows;
    */

    await this.crawler.withHumanPage(async (page, _ctx, H) => {
      // 1–2) open start page and settle
      await H.openForever(startUrl, this.SEL_SEARCH_TEXTAREA, { deadlineMs: 60_000 });
      await H.sometimesPause(0.5, [1500, 2500]);
      console.log(`Browser opened and url loaded`);

      for (const rec of records) {
        console.log(`Starting the loop of records`);
        const city  = rec.fr_user_addresses?.[0]?.fr_city?.name || '';
        const state = rec.fr_user_addresses?.[0]?.fr_state?.name || '';
        const comp  = rec.fr_user_corporate_infos?.company_name || '';

        console.log(`Creating 3 types of keyword`);
        const kw1 = this.buildKw1(rec.fname, rec.lname, comp, city, state);
        const kw2 = this.buildKw2(rec.fname, rec.lname, city, state);
        //const kw3 = this.buildKw3(comp, city, state);
        
        const baseAttempts = [
            { key: 'kw1', text: kw1 },
            { key: 'kw2', text: kw2 },
            //{ key: 'kw3', text: kw3 },
          ] as const satisfies ReadonlyArray<Attempt>;
          
          const attempts: Attempt[] = baseAttempts
            .filter(a => a.text.trim().length > 0);

        let doneForThisPerson = false;
        
        for (const attempt of attempts) {
            console.log(`Starting the loop for possible 3 keywords search`);
          // 3) type into search box
          const input = page.locator(this.SEL_SEARCH_TEXTAREA).first();
          await H.typing(input, attempt.text, {
            clearFirst: true,
            typos: true,
            burstChance: 0.15,
            noisyBursts: true,
            delayRange: [-20, 0],
            selectAllFirst: true
          });
          
          console.log(`Keyword entered in the search box and pressing enter key`);
          // 5) small wait + Enter
          await page.waitForTimeout(3000);
          await input.press('Enter').catch(async () => { await page.keyboard.press('Enter').catch(() => {}); });
          await page.waitForLoadState('domcontentloaded').catch(() => {});

          // 6–7) wait for possible GMB container or results to settle
          await H.visibleForever('body', { deadlineMs: 20_000 }).catch(() => {});
          const gmb = page.locator(this.SEL_GMB_CONTAINER).first();

          console.log(`Checking if GMB info found or not`);
          if ((await gmb.count().catch(() => 0)) === 0) {
            // 8) not found -> try next keyword
            await H.smoothScrollToBottom(700);
            this.log.debug(`GMB panel not found for ${attempt.key} "${attempt.text}". Trying next.`);
            await H.smoothScrollToTop();

            //if(attempt.key === 'kw2') {await this.returnToOriginAfterLastKw(page);}
            continue;
          }

          await H.smoothScrollToBottom(700);
          this.log.debug(`GMB panel found for ${attempt.key} "${attempt.text}". Going forward.`);
          await H.smoothScrollToTop();

          console.log(`Bring the gmb info in view port`);
          // 9) scroll to GMB element
          await gmb.scrollIntoViewIfNeeded().catch(() => {});
          await H.sometimesPause(0.6, [700, 1000]);

          console.log(`Get the business name from GMB profile`);
          // 10) business name
          const busns_name = await this.textSafe(gmb.locator(this.SEL_GMB_BUSINESS_NAME));
          if (!busns_name) {
            // can't match without a name; try next keyword
            this.log.debug(`No business name for ${attempt.key}. Skipping attempt.`);

            //if(attempt.key === 'kw2') {await this.returnToOriginAfterLastKw(page);}

            continue;
          }

          console.log(`Match the business name with record`);
          // 11) fuzzy match against keywords (fname/lname/company)
          const similar = this.similarToKeywords(busns_name, rec);
          if (!similar) {
            // not a match -> try next keyword
            console.log(`GMB business name does not match with record. Moving to next attempt.`);
            this.log.debug(`Name "${busns_name}" not similar to record ${rec.id}. Trying next keyword.`);

            //if(attempt.key === 'kw2') {await this.returnToOriginAfterLastKw(page);}

            continue;
          }
          console.log(`GMB business name match found with record`);

          console.log(`Create storage to save data as GMB profile is confirmed`);
          // 12–18) extract info INSIDE GMB container
          const row: GmbScrapedRow = {
            lead_id: rec.id,
            kw_used: attempt.key,
            keyword: attempt.text,
            busns_name,
            // defaults
            busns_busseccat_id_1: null,
            busns_address: null,
            busns_country: 'USA',
            busns_state: null,
            busns_city: null,
            busns_zipcode: null,
            busns_mobile: null,
            google_reviews: null,
            busns_website_url: null,
            busns_google_my_business_url: null,
            busns_google_map_url: null,
            busns_facebook_profile: null,
            busns_linkedin_profile: null,
            busns_instagram_profile: null,
            busns_youtube_profile: null,
            busns_x_profile: null,
            busns_tiktok_profile: null,
            busns_pinterest_profile: null,
            gmb_matched: true,
            crawler_updated: new Date().toISOString(),
            crawler_stage: 'gmb',
          };

          // 13) reviews
          console.log(`Getting the google review count`);
          const reviewsText = await this.textSafe(gmb.locator(this.SEL_GMB_REVIEWS));
          row.google_reviews = this.parseIntFromText(reviewsText);

          // 14) category (first part before " in ")
          console.log(`Getting the google business category`);
          const catText = await this.textSafe(gmb.locator(this.SEL_GMB_CATEGORY));
          row.busns_busseccat_id_1 = this.beforeIn(catText);

          // 15) unified actions (website + GMB business link via popup)
          console.log(`Getting the google my business share URL`);
          const actions = gmb.locator(this.SEL_GMB_ACTIONS).first();
          if (await actions.count()) {
            row.busns_website_url = await this.attrSafe(actions.locator(this.SEL_GMB_WEBSITE), 'href');

            const bizBtn = actions.locator(this.SEL_GMB_BUSINESS_LINK).first();
            if (await bizBtn.count()) {
                console.log(`Opening popup`);
              await bizBtn.click().catch(() => {});
              const popup = page.locator(this.SEL_GMB_POPUP).first();
              // wait a bit for popup
              await H.visibleForever(popup, { deadlineMs: 8000, throwOnTimeout: false });
              if (await popup.isVisible().catch(() => false)) {
                row.busns_google_my_business_url = await this.attrSafe(popup.locator(this.SEL_GMB_POPUP_LINK), 'href');
                // close popup
                console.log(`Closing popup`);
                /*
                // not working the close by click for some reason
                const close = page.locator(this.SEL_GMB_POPUP_CLOSE).first();
                if (await close.count()) await close.click().catch((e) => {
                  this.log.debug(`Failed to close GMB popup ${e}`);
                });
                */
                // use go back to close popup
                await page.goBack().catch(() => {});
              }
            }
          }

          // 16) address
          console.log(`Getting the business address`);
          row.busns_address = await this.textSafe(gmb.locator(this.SEL_GMB_ADDRESS));

          // process the address and seperate it
          const parsed = this.libraryAppService.parseUsaAddress(row.busns_address);
            row.busns_address = parsed.address;
            row.busns_city = parsed.city;
            row.busns_state = parsed.state;
            row.busns_zipcode = parsed.zipcode;

          // 17) phone
          console.log(`Getting the business pone number`);
          const phoneText = await this.textSafe(gmb.locator(this.SEL_GMB_ALT_PHONE));
          row.busns_mobile = phoneText ? this.cleanPhone(phoneText) : null;

          // 18) social presence
          console.log(`Getting the social media links if any`);
          const social = gmb.locator(this.SEL_GMB_SOCIAL_SECTION).first();
          if (await social.count()) {
            await social.scrollIntoViewIfNeeded().catch(() => {});
            await page.waitForTimeout(150);
            row.busns_facebook_profile  = await this.attrSafe(social.locator(this.SEL_SOC_FB), 'href');
            row.busns_linkedin_profile  = await this.attrSafe(social.locator(this.SEL_SOC_LI), 'href');
            row.busns_instagram_profile = await this.attrSafe(social.locator(this.SEL_SOC_IG), 'href');
            row.busns_youtube_profile   = await this.attrSafe(social.locator(this.SEL_SOC_YT), 'href');
            row.busns_x_profile         = await this.attrSafe(social.locator(this.SEL_SOC_X),  'href');
            row.busns_tiktok_profile    = await this.attrSafe(social.locator(this.SEL_SOC_TT), 'href');
            row.busns_pinterest_profile = await this.attrSafe(social.locator(this.SEL_SOC_PI), 'href');
          }

          // 19) maps share link
          console.log(`Getting the google map share URL`);
          const mapEntry = gmb.locator(this.SEL_GMB_MAP_ENTRY).first();
          if (await mapEntry.count()) {
            console.log(`Redirecting to google map`);
            await mapEntry.click().catch(() => {});
            await page.waitForLoadState('load').catch(() => {});

            const shareBtn = page.locator(this.SEL_MAP_SHARE_BTN).first();
            await H.visibleForever(shareBtn, { deadlineMs: 12000, throwOnTimeout: false });
            if (await shareBtn.isVisible().catch(() => false)) {
                console.log(`Clicking in share button`);
              await shareBtn.click().catch(() => {});
              const shareInput = page.locator(this.SEL_MAP_SHARE_INPUT).first();
              await H.visibleForever(shareInput, { deadlineMs: 8000, throwOnTimeout: false });
              console.log(`Share popup opened`);
              row.busns_google_map_url = await shareInput.inputValue().catch(() => null);
              
              // wait befoe close to pretent like human
              await H.sometimesPause(0.6, [3000, 4000]);
              
              // if close do not work just go back
              const closeShare = page.locator(this.SEL_MAP_CLOSE).first();
              if (await closeShare.count()) await closeShare.click().catch((e) => {
                this.log.debug(`Failed to close GMB share ${e}`);
              });
              console.log(`Share popup closed`);
            }
            // wait befoe close to pretent like human
            await H.sometimesPause(0.6, [1500, 2000]);

            // 20) go back
            console.log(`Map realed work over going back to search result page`);
            await H.backForever(this.SEL_GMB_CONTAINER, { deadlineMs: 12000, throwOnTimeout: false }).catch(() => {});
          }

          // 21) push to rows
          console.log(`Saving the data for ${rec.id} using ${attempt.key}: ${attempt.text}`);
          rows.push(row);
          this.log.debug(`Saved row for input ${rec.id} using ${attempt.key}: ${attempt.text}`);
          
          // 22) back to search box for next person
          console.log(`Records are finished, so going back to search box for next keyword`);
          await H.backForever(this.SEL_SEARCH_TEXTAREA, { deadlineMs: 12000, throwOnTimeout: false }).catch(() => {});
          page.waitForLoadState('domcontentloaded').catch(() => {});
          await H.visibleForever(this.SEL_SEARCH_TEXTAREA, { deadlineMs: 8000 }).catch(() => {});
          doneForThisPerson = true;

          console.log(`Ending the loop for possible 3 keywords search`);
          await H.smoothScrollToBottom(300);
          break; // move to next person
        } // attempts loop

        if (!doneForThisPerson) {
          // Just ensure we are on the search page for the next record
          await H.visibleForever(this.SEL_SEARCH_TEXTAREA, { deadlineMs: 8000, throwOnTimeout: false }).catch(() => {});
        }
        console.log(`Completed the record loop`);
      } // records loop
      
      // 23) print JSON (optional)
      this.log.debug(`GMB crawl complete. Rows=${rows.length}`);
      console.log(`GMB crawl complete. Rows=${rows.length}`);
      console.log(JSON.stringify(rows, null, 2));
    }, {
      url: startUrl,
      label: 'gmbHumanCrawler',
    });

    return rows;
  }

  // ===== Keyword builders =====

  private async returnToOriginAfterLastKw(page: Page) {
      await page.goBack();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.goBack();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
  }

  private buildKw1(fname: string, lname: string, company: string, city: string, state: string) {
    const parts = [fname, lname, company, city, state].map(this.normPart).filter(Boolean);
    if (!parts.length) return '';
    // "Matt Laricy, Americorp Real Estate, Chicago, Illinois"
    const [fn, ln, ...rest] = parts;
    return `${fn} ${ln}${rest.length ? ', ' + rest.join(', ') : ''}`;
  }

  private buildKw2(fname: string, lname: string, city: string, state: string) {
    const parts = [fname, lname, city, state].map(this.normPart).filter(Boolean);
    if (!parts.length) return '';
    const [fn, ln, ...rest] = parts;
    return `${fn} ${ln}${rest.length ? ', ' + rest.join(', ') : ''}`;
  }

  private buildKw3(company: string, city: string, state: string) {
    const parts = [company, city, state].map(this.normPart).filter(Boolean);
    return parts.join(', ');
  }

  private normPart = (s?: string) => (s ?? '').toString().trim();

  // ===== Matching logic =====

  /** Returns true if GMB name looks like it's for the given record (fuzzy). */
  private similarToKeywords(bizName: string, rec: GmbInputRecord): boolean {
    const name = this.cleanName(bizName);
    const fname = this.cleanName(rec.fname);
    const lname = this.cleanName(rec.lname);
    const company = this.cleanName(rec.fr_user_corporate_infos?.company_name || '');

    // rule 1: both first and last name contained
    if (fname && lname && name.includes(fname) && name.includes(lname)) return true;

    // rule 2: last name + org suffix (team, group, realty, real estate, associates, llc, inc)
    if (lname && name.includes(lname) && /(team|group|realty|estate|associates|llc|inc|brokerage)/i.test(bizName)) return true;

    // rule 3: company token overlap
    if (company) {
      const overlap = this.tokenOverlap(name, company);
      if (overlap >= 0.5) return true;
    }

    // rule 4: Jaccard tokens vs (first+last) or company (lower threshold)
    const person = this.tokenOverlap(name, `${fname} ${lname}`);
    if (person >= 0.45) return true;

    return false;
  }

  private cleanName(s: string): string {
    return s
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\b(the|llc|inc|co|company|corp|realty|real\s*estate|group|team|associates|llp|pllc|plc|ltd)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenOverlap(a: string, b: string): number {
    const A = new Set(a.split(/\s+/).filter(Boolean));
    const B = new Set(b.split(/\s+/).filter(Boolean));
    const inter = new Set([...A].filter(x => B.has(x)));
    const union = new Set([...A, ...B]);
    return union.size ? inter.size / union.size : 0;
  }

  // ===== Safe DOM helpers (fast: no implicit waits) =====

  private async textSafe(loc: Locator): Promise<string | null> {
    try {
      if ((await loc.count()) === 0) return null;
      const t = await loc.first().textContent();
      return t ? t.replace(/\s+/g, ' ').trim() : null;
    } catch { return null; }
  }

  private async innerTextSafe(loc: Locator): Promise<string | null> {
    try {
      if ((await loc.count()) === 0) return null;
      const t = await loc.first().innerText();
      return t ? t.replace(/\s+/g, ' ').trim() : null;
    } catch { return null; }
  }

  private async attrSafe(loc: Locator, attr: string): Promise<string | null> {
    try {
      if ((await loc.count()) === 0) return null;
      return await loc.first().getAttribute(attr);
    } catch { return null; }
  }

  private parseIntFromText(s?: string | null): number | null {
    if (!s) return null;
    const m = s.replace(/,/g, '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  private beforeIn(s?: string | null): string | null {
    if (!s) return null;
    const i = s.toLowerCase().indexOf(' in ');
    const out = i >= 0 ? s.slice(0, i) : s;
    return out.replace(/\s+/g, ' ').trim();
  }

  private cleanPhone(s: string): string {
    // remove spaces, hyphens, parentheses; keep + and digits
    const digits = s.replace(/[^\d+]/g, '');
    // normalize like +18035551234 or (803) 555-1234 -> 8035551234
    if (digits.startsWith('+')) return digits;
    return digits.replace(/^1?(\d{10,})$/, '$1');
  }
}
