import { Module } from "@nestjs/common";
import { ZillowCrawlerService } from "./zillow.crawler.service";
import { WebCrawlerModule } from "@libs/library-app";
import { CrawlerLeadModule } from "@libs/dynamic-app";

@Module({
  imports: [
    WebCrawlerModule,
    CrawlerLeadModule
  ],
  controllers: [],
  providers: [ZillowCrawlerService],
  exports: [],
})
export class ZillowCrawlerModule {

 
}