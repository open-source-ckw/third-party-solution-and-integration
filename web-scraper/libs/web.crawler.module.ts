import { Module } from '@nestjs/common';
import { WebCrawlerService } from './web.crawler.service';
import { PlaywrightModule } from './playwright/playwright.module';

@Module({
    imports: [
        PlaywrightModule
    ],
    providers: [WebCrawlerService],
    exports: [
        WebCrawlerService
    ]
})
export class WebCrawlerModule {

}
