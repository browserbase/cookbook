import Stripe from 'stripe';
import dotenv from 'dotenv';
import { pathToFileURL } from 'node:url';

function verifyHolder(holder: Stripe.Issuing.Cardholder, holderId: string) {
    if (holder.id !== holderId || holder.livemode !== false || holder.status !== 'active'
        || !holder.requirements || holder.requirements.disabled_reason !== null
        || !Array.isArray(holder.requirements.past_due) || holder.requirements.past_due.length !== 0) {
        throw new Error('Test cardholder is not ready to use cards. Resolve account requirements before continuing.');
    }
}

export async function createCardholder(env: NodeJS.ProcessEnv = process.env) {
    const apiKey = env.STRIPE_API_KEY;
    const idempotencyKey = env.STRIPE_TEST_CARDHOLDER_KEY;
    if (!apiKey || !/^sk_test_[A-Za-z0-9]+$/.test(apiKey)) {
        throw new Error('STRIPE_API_KEY must be a test secret key.');
    }
    if (!idempotencyKey || !/^[A-Za-z0-9-]{1,255}$/.test(idempotencyKey)) {
        throw new Error('STRIPE_TEST_CARDHOLDER_KEY must identify this test cardholder creation attempt.');
    }
    const stripe = new Stripe(apiKey, { timeout: 30_000, maxNetworkRetries: 0 });
    const created = await stripe.issuing.cardholders.create({
        name: 'Alex Example',
        email: 'alex@example.com',
        phone_number: '+12025550123',
        status: 'active',
        type: 'individual',
        individual: {
            first_name: 'Alex',
            last_name: 'Example',
            dob: { day: 1, month: 1, year: 1990 },
        },
        billing: {
            address: {
                line1: '123 Main Street',
                city: 'San Francisco',
                state: 'CA',
                country: 'US',
                postal_code: '94111',
            },
        },
    }, { idempotencyKey });
    if (typeof created.id !== 'string' || !/^ich_[A-Za-z0-9]+$/.test(created.id)) {
        throw new Error('The created test cardholder ID could not be verified.');
    }
    verifyHolder(created, created.id);
    const cardholder = await stripe.issuing.cardholders.retrieve(created.id);
    verifyHolder(cardholder, created.id);
    return cardholder;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    dotenv.config();
    createCardholder().then(cardholder => {
        console.log('Verified active test cardholder:', cardholder.id);
    }).catch(() => {
        console.error('Test cardholder creation or readiness verification failed.');
        process.exitCode = 1;
    });
}
