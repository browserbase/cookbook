import { browserbase, Stagehand, type StagehandBrowser } from '@browserbasehq/stagehand';
import Browserbase from '@browserbasehq/sdk';
import dotenv from 'dotenv';
import { pathToFileURL } from 'node:url';
import { main, prepare } from './4-make-payment.js';

export async function run() {
    const prepared = await prepare();
    const { config } = prepared;
    const bb = new Browserbase({ apiKey: config.browserKey });
    let browser: StagehandBrowser | undefined;
    let stagehand: Stagehand | undefined;
    let sessionId: string | undefined;
    const failures: unknown[] = [];
    try {
        browser = await browserbase.launch({
            apiKey: config.browserKey, api_timeout: 300,
        });
        sessionId = browser.sessionId;
        if (!sessionId) throw new Error('The owned Browserbase session is unavailable.');
        stagehand = await Stagehand.create({
            browser,
            model: { modelName: 'openai/gpt-4.1', apiKey: config.modelKey },
        });
        await main({ browser, stagehand, prepared });
    } catch (error) {
        failures.push(error);
    } finally {
        if (stagehand) {
            try { await stagehand.close(); } catch (error) { failures.push(error); }
        }
        if (browser) {
            try { await browser.close(); } catch (error) { failures.push(error); }
        }
        if (sessionId) {
            try {
                await bb.sessions.update(sessionId, {
                    status: 'REQUEST_RELEASE',
                }, { timeout: 30_000, maxRetries: 0 });
            } catch (error) { failures.push(error); }
        }
    }
    if (failures.length) throw new AggregateError(failures, 'Sandbox authorization workflow failed.');
    console.log('Test authorization approved and pending. No purchase or donation was made.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    dotenv.config();
    run().catch(() => {
        console.error('Sandbox authorization failed.');
        process.exitCode = 1;
    });
}
