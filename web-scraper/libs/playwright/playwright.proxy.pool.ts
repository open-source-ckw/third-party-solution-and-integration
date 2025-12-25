import { ConfService } from '../../conf/conf.service';
import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import { ProxyRecord } from './playwright.type';
import { LogService } from '../../log/log.service';

/**
 * Loads proxies from PLAYWRIGHT_PROXY_SOURCE and returns round‑robin selections.
 * Accepted formats:
 *  - file:/local-storage/proxies.txt   (one per line)
 *      http://user:pass@host:port
 *      socks5://host:1080
 *      host:port|username|password
 *  - inline:http://u:p@h:8080,https://h2:3128
 * 
 * Check: https://ipapi.co/
 * If required check others as below
 * Check to get free proxi serves: 
 * https://spys.one/en/socks-proxy-list/
 * https://geonode.com/free-proxy-list 
 * https://proxyscrape.com/free-proxy-list
 * Check ip info (set your ip): https://whatismyipaddress.com/ip/72.195.101.99 | https://www.iplocation.net/myip
 * Check connection info: https://dnschecker.org/user-agent-info.php
 * Check headers: http://httpbin.org/headers
 * 
 * check proxi connection: 
 * curl -x socks5://104.129.205.15:10289 https://ipapi.co/json
 */
@Injectable()
export class PlaywrightProxyPool {
  private readonly log: LogService;
  private proxies: ProxyRecord[] = [];
  private idx = 0;

  constructor(private readonly conf: ConfService) {
    this.load();
  }

  load() {
    this.proxies = [];
    const src = this.conf.playwrightProxySource;
    if (!src) return;

    if (src.startsWith('file:')) {
      const p = src.slice('file:'.length);
      if (!fs.existsSync(p)) return;
      const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      for (const line of lines) this.pushParsed(line);
    } else if (src.startsWith('inline:')) {
      const list = src.slice('inline:'.length);
      for (const item of list.split(',').map(s => s.trim()).filter(Boolean)) {
        this.pushParsed(item);
      }
    }
    this.log?.info?.({ count: this.proxies.length, src }, 'ProxyPool loaded');
  }

  private pushParsed(raw: string) {
    // url-like? -> parse with URL
    if (/^[a-z]+:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        const rec: ProxyRecord = {
          server: `${u.protocol}//${u.hostname}:${u.port}`,
        };
        if (u.username) rec.username = decodeURIComponent(u.username);
        if (u.password) rec.password = decodeURIComponent(u.password);
        this.proxies.push(rec);
        return;
      } catch { /* ignore */ }
    }
    // pipe form: host:port|user|pass  OR  http://host:port|user|pass
    const [hp, user, pass] = raw.split('|');
    if (!hp) return;
    const server = hp.startsWith('http') || hp.startsWith('socks') ? hp : `http://${hp}`;
    const rec: ProxyRecord = { server };
    if (user) rec.username = user;
    if (pass) rec.password = pass;
    this.proxies.push(rec);
  }

  has(): boolean { return this.proxies.length > 0; }

  /** Round‑robin selection (customize to add per‑domain stickiness if needed) */
  pick(): ProxyRecord | undefined {
    if (!this.has()) return undefined;
    const rec = this.proxies[this.idx % this.proxies.length];
    this.idx++;
    return rec;
  }
}
