import { BrowserContext } from "@playwright/test";

export type TraceMode = 'off' | 'on' | 'retain-on-failure';

/** One proxy entry */
export type ProxyRecord = {
    server: string;       // e.g. http://host:port or socks5://host:port
    username?: string;
    password?: string;
};

export type Viewport = { width: number; height: number; deviceScaleFactor?: number; isMobile?: boolean; hasTouch?: boolean };


export type PoolItem = {
    ctx: BrowserContext;
    inUse: boolean;
    createdAt: number;
    jobsDone: number;
    label?: string; // e.g., domain if per-domain sessions
};

export type WithPageOpts = {
    url?: string;                  // used for per-host throttling and logs
    label?: string;                // used to name trace/video/har files
    headed?: boolean;              // override headless
    slowMoMs?: number;             // per-call slowMo
    devtools?: boolean;            // open devtools
    trace?: TraceMode;
    recordVideo?: boolean;
    blockMedia?: boolean;          // override defaults
    blockAnalytics?: boolean;
    pause?: boolean;               // open inspector via page.pause()
    meta?: Record<string, any>;
    
     /** keep cookies/session in a per-session userDataDir */
    persistentSessionId?: string;

    /** auto-close this persistent context after N ms of inactivity (optional) */
    persistentKeepAliveMs?: number
  };

  export type IpApiShape = {
    ip: string | null;
    network: string | null;
    version: 'IPv4' | 'IPv6' | null;
    city: string | null;
    region: string | null;
    region_code: string | null;
    country: string | null;        // 2-letter, sometimes
    country_name: string | null;
    country_code: string | null;   // 2-letter
    country_code_iso3: string | null;
    country_capital: string | null;
    country_tld: string | null;
    continent_code: string | null;
    in_eu: boolean | null;
    postal: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone: string | null;
    utc_offset: string | null;
    country_calling_code: string | null;
    currency: string | null;
    currency_name: string | null;
    languages: string | null;
    country_area: number | null;
    country_population: number | null;
    asn: string | null;
    org: string | null;
  };