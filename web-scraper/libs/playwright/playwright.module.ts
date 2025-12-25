import { Module } from '@nestjs/common';
import { PlaywrightProxyPool } from './playwright.proxy.pool';
import { PlaywrightUaPool } from './playwright.ua.pool';
import { PlaywrightService } from './playwright.service';
import { PlaywrightHuman } from './playwright.human';

@Module({
    controllers: [],
    providers: [
        PlaywrightService, 
        PlaywrightProxyPool, 
        PlaywrightUaPool,
        PlaywrightHuman
    ],
    exports: [PlaywrightService],
})
export class PlaywrightModule {}
