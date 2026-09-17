import { type Stagehand, type StagehandBrowser } from '@browserbasehq/stagehand';
import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
    const apiKey = env.STRIPE_API_KEY;
    const cardId = env.STRIPE_CARD_ID;
    const holderId = env.STRIPE_CARDHOLDER_ID;
    const browserKey = env.BROWSERBASE_API_KEY;
    const authorizationKey = env.STRIPE_TEST_AUTHORIZATION_KEY;
    const modelKey = env.OPENAI_API_KEY;
    if (!apiKey || !/^sk_test_[A-Za-z0-9]+$/.test(apiKey)
        || !cardId || !/^ic_[A-Za-z0-9]+$/.test(cardId)
        || !holderId || !/^ich_[A-Za-z0-9]+$/.test(holderId)
        || !browserKey?.trim() || !modelKey?.trim()
        || !authorizationKey || !/^[A-Za-z0-9-]{1,255}$/.test(authorizationKey)) {
        throw new Error('Explicit test card, cardholder, browser, model, and authorization configuration is required.');
    }
    return { apiKey, cardId, holderId, browserKey, authorizationKey, modelKey };
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

export async function prepare() {
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
    return { config, stripe };
}

export async function main({ browser, stagehand, prepared }: {
    browser: StagehandBrowser;
    stagehand: Stagehand;
    prepared: Awaited<ReturnType<typeof prepare>>;
}) {
    const { config, stripe } = prepared;
    const page = await browser.context.newPage();
    const nonce = randomUUID();
    await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(checkoutHtml(nonce))}`, { timeout: 30_000 });
    const action = await stagehand.act('Click Confirm test order', { page, timeout: 30_000 });
    if (action.data.success !== true) throw new Error('The sandbox confirmation action failed.');
    const receipt = await page.evaluate(() => {
        const element = document.getElementById('receipt');
        return element ? {
            amount: element.getAttribute('data-amount'),
            currency: element.getAttribute('data-currency'),
            nonce: element.getAttribute('data-nonce'),
            text: element.textContent,
        } : null;
    });
    if (!receipt || receipt.amount !== '1000' || receipt.currency !== 'usd' || receipt.nonce !== nonce
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
}
