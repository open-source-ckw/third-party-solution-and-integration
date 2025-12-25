import { Controller, Get } from '@nestjs/common';
import { ZillowCrawlerService } from './zillow.crawler.service';

@Controller()
export class ZillowCrawlerController {
  constructor(private readonly service: ZillowCrawlerService) {}

  
}
