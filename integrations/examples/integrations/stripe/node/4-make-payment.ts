import dotenv from 'dotenv';
import Stripe from 'stripe';
import { chromium, type Browser } from 'playwright-core';
import Browserbase from '@browserbasehq/sdk';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
    const apiKey = env.STRIPE_API_KEY;
    const cardId = env.STRIPE_CARD_ID;
    const holderId = env.STRIPE_CARDHOLDER_ID;
    const browserKey = env.BROWSERBASE_API_KEY;
    const projectId = env.BROWSERBASE_PROJECT_ID;
    const authorizationKey = env.STRIPE_TEST_AUTHORIZATION_KEY;
    if (!apiKey || !/^sk_test_[A-Za-z0-9]+$/.test(apiKey)
        || !cardId || !/^ic_[A-Za-z0-9]+$/.test(cardId)
        || !holderId || !/^ich_[A-Za-z0-9]+$/.test(holderId)
        || !browserKey?.trim() || !projectId?.trim()
        || !authorizationKey || !/^[A-Za-z0-9-]{1,255}$/.test(authorizationKey)) {
        throw new Error('Explicit test card, cardholder, browser, and authorization configuration is required.');
    }
    return { apiKey, cardId, holderId, browserKey, projectId, authorizationKey };
}

export function checkoutHtml(nonce: string) {
    if (!/^[A-Za-z0-9-]+$/.test(nonce)) throw new Error('Invalid checkout nonce.');
    return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Cookbook sandbox checkout</title>
<body><h1>Cookbook sandbox checkout</h1><p>Test order: USD 10.00. No purchase or donation is made.</p>
<button id="confirm" type="button">Confirm test order</button><output id="receipt"></output>
<script>document.getElementById('confirm').addEventListener('click', () => {
const receipt = document.getElementById('receipt');
receipt.dataset.amount = '1000'; receipt.dataset.currency = 'usd'; receipt.dataset.nonce = '${nonce}';
receipt.textContent = 'Test order confirmed';
});</script></body></html>`;
}

function verifyCard(card: Stripe.Issuing.Card, cardId: string, holderId: string) {
    const holder = typeof card.cardholder === 'string' ? card.cardholder : card.cardholder?.id;
    if (card.id !== cardId || card.livemode !== false || card.status !== 'active' || holder !== holderId) {
        throw new Error('Active test card state could not be verified.');
    }
}

export function verifyAuthorization(authorization: Stripe.Issuing.Authorization, cardId: string, holderId: string) {
    const card = typeof authorization.card === 'string' ? authorization.card : authorization.card?.id;
    const holder = typeof authorization.cardholder === 'string' ? authorization.cardholder : authorization.cardholder?.id;
    if (!/^iauth_[A-Za-z0-9]+$/.test(authorization.id)
        || authorization.livemode !== false || card !== cardId || holder !== holderId
        || authorization.amount !== 1000 || authorization.currency !== 'usd'
        || authorization.approved !== true || authorization.status !== 'pending') {
        throw new Error('Test authorization was declined or could not be verified.');
    }
}

export async function run() {
    const config = readConfig();
    const stripe = new Stripe(config.apiKey, { timeout: 30_000, maxNetworkRetries: 0 });
    const card = await stripe.issuing.cards.retrieve(config.cardId);
    verifyCard(card, config.cardId, config.holderId);
    const holder = await stripe.issuing.cardholders.retrieve(config.holderId);
    if (holder.id !== config.holderId || holder.livemode !== false || holder.status !== 'active'
        || !holder.requirements || holder.requirements.disabled_reason !== null
        || !Array.isArray(holder.requirements.past_due) || holder.requirements.past_due.length !== 0) {
        throw new Error('Test cardholder is not ready to use cards.');
    }
    const bb = new Browserbase({ apiKey: config.browserKey });
    const options = { timeout: 30_000, maxRetries: 0 };
    const session = await bb.sessions.create({ projectId: config.projectId, api_timeout: 300 }, options);
    let browser: Browser | undefined;
    const failures: unknown[] = [];
    try {
        browser = await chromium.connectOverCDP(session.connectUrl, { timeout: 30_000 });
        const context = browser.contexts()[0];
        if (!context) throw new Error('Browser context is unavailable.');
        const page = await context.newPage();
        const nonce = randomUUID();
        await page.setContent(checkoutHtml(nonce), { timeout: 30_000 });
        await page.locator('#confirm').click({ timeout: 30_000 });
        const receipt = await page.locator('#receipt').evaluate(element => ({
            amount: element.getAttribute('data-amount'),
            currency: element.getAttribute('data-currency'),
            nonce: element.getAttribute('data-nonce'),
            text: element.textContent,
        }));
        if (receipt.amount !== '1000' || receipt.currency !== 'usd' || receipt.nonce !== nonce
            || receipt.text !== 'Test order confirmed') {
            throw new Error('The sandbox order receipt could not be verified.');
        }
        const authorization = await stripe.testHelpers.issuing.authorizations.create({
            card: config.cardId,
            amount: 1000,
            currency: 'usd',
            authorization_method: 'online',
            merchant_data: {
                category: 'charitable_and_social_service_organizations_fundraising',
                name: 'Cookbook Sandbox',
                country: 'US',
            },
        }, { idempotencyKey: config.authorizationKey });
        verifyAuthorization(authorization, config.cardId, config.holderId);
    } catch (error) {
        failures.push(error);
    } finally {
        if (browser) {
            try { await browser.close(); } catch (error) { failures.push(error); }
        }
        try {
            await bb.sessions.update(session.id, {
                projectId: config.projectId, status: 'REQUEST_RELEASE',
            }, options);
        } catch (error) { failures.push(error); }
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
