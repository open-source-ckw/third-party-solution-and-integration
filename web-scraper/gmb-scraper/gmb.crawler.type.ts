// web-crawler/gmb.crawler.type.ts

export type Attempt = { key: 'kw1' | 'kw2' | 'kw3'; text: string };


export type GmbInputRecord = {
    id: number;
    fname: string;
    lname: string;
    fr_user_addresses: Array<{
      fr_city: { name: string };
      fr_state: { name: string };
    }>;
    fr_user_corporate_infos?: {
      company_name?: string;
    } | null;
  };
  
  export type GmbScrapedRow = {
    lead_id: number;
    
    // core business data
    busns_name: string | null;
    busns_busseccat_id_1: string | null;
    busns_address: string | null;
    busns_country: string | null;
    busns_state: string | null;
    busns_city: string | null;
    busns_zipcode: string | null;
    busns_mobile: string | null;
  
    // links
    busns_website_url: string | null;
    busns_google_my_business_url: string | null;
    busns_google_map_url: string | null;
  
    // socials
    busns_facebook_profile: string | null;
    busns_linkedin_profile: string | null;
    busns_instagram_profile: string | null;
    busns_youtube_profile: string | null;
    busns_x_profile: string | null;
    busns_tiktok_profile: string | null;
    busns_pinterest_profile: string | null;
    crawler_updated: string;  // ISO timestamp

    // etc
    crawler_stage: string;   // static gmb
    gmb_matched: boolean;
    google_reviews: number | null;
    kw_used: 'kw1' | 'kw2' | 'kw3';
    keyword: string;
  };
  