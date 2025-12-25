import { Module } from '@nestjs/common';
import { GmbCrawlerService } from './gmb.crawler.service';
import { WebCrawlerModule } from '@libs/library-app';
import { ThatsendApiModule } from '@libs/dynamic-app';


@Module({
  imports: [
    WebCrawlerModule,
    ThatsendApiModule,
  ],
  providers: [GmbCrawlerService],
  exports: [GmbCrawlerService],
})
export class GmbCrawlerModule {}