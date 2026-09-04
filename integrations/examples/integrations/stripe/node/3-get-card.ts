import Stripe from 'stripe';
import dotenv from 'dotenv';
import { pathToFileURL } from 'node:url';

function verifyCard(card: Stripe.Issuing.Card, cardId: string, holderId: string) {
    const holder = typeof card.cardholder === 'string' ? card.cardholder : card.cardholder?.id;
    if (card.id !== cardId || card.livemode !== false || card.status !== 'active' || holder !== holderId) {
        throw new Error('Active test card state could not be verified.');
    }
}

function verifyHolder(holder: Stripe.Issuing.Cardholder, holderId: string) {
    if (holder.id !== holderId || holder.livemode !== false || holder.status !== 'active'
        || !holder.requirements || holder.requirements.disabled_reason !== null
        || !Array.isArray(holder.requirements.past_due) || holder.requirements.past_due.length !== 0) {
        throw new Error('Test cardholder is not ready to use cards.');
    }
}

export async function getCard(cardId: string) {
    const apiKey = process.env.STRIPE_API_KEY;
    const holderId = process.env.STRIPE_CARDHOLDER_ID;
    if (!apiKey?.startsWith('sk_test_') || apiKey.length <= 'sk_test_'.length) {
        throw new Error('STRIPE_API_KEY must be a test secret key.');
    }
    if (typeof cardId !== 'string' || !/^ic_[A-Za-z0-9]+$/.test(cardId)) {
        throw new Error('An explicit issuing card ID is required.');
    }
    if (!holderId || !/^ich_[A-Za-z0-9]+$/.test(holderId)) {
        throw new Error('STRIPE_CARDHOLDER_ID must be an explicit cardholder ID.');
    }
    const stripe = new Stripe(apiKey);
    const metadata = await stripe.issuing.cards.retrieve(cardId);
    verifyCard(metadata, cardId, holderId);
    const holder = await stripe.issuing.cardholders.retrieve(holderId);
    verifyHolder(holder, holderId);
    const card = await stripe.issuing.cards.retrieve(cardId, { expand: ['number', 'cvc'] });
    verifyCard(card, cardId, holderId);
    verifyHolder(card.cardholder, holderId);
    const paymentHolder = card.cardholder;
    const name = paymentHolder.name.trim().split(/\s+/);
    if (!name[0] || !paymentHolder.email || !paymentHolder.phone_number || !paymentHolder.billing?.address
        || typeof card.number !== 'string' || !/^\d{12,19}$/.test(card.number)
        || typeof card.cvc !== 'string' || !/^\d{3,4}$/.test(card.cvc)
        || !Number.isInteger(card.exp_month) || card.exp_month < 1 || card.exp_month > 12
        || !Number.isInteger(card.exp_year) || card.exp_year < 2000
        || !card.brand || !card.currency || !/^\d{4}$/.test(card.last4)) {
        throw new Error('Required test payment fields are unavailable.');
    }
    return {
        id: card.id,
        status: card.status,
        livemode: card.livemode,
        last4: card.last4,
        cardholder_firstName: name[0],
        cardholder_lastName: name.slice(1).join(' '),
        cardholder_email: paymentHolder.email,
        cardholder_phone: paymentHolder.phone_number,
        cardholder_address: paymentHolder.billing.address,
        card_number: card.number,
        expiration_month: card.exp_month,
        expiration_year: card.exp_year.toString().slice(-2),
        cvc: card.cvc,
        brand: card.brand,
        currency: card.currency,
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    dotenv.config();
    getCard(process.env.STRIPE_CARD_ID ?? '').then(({ id, status, last4 }) => {
        console.log('Verified test card:', { id, status, last4 });
    }).catch(() => {
        console.error('Test card retrieval failed.');
        process.exitCode = 1;
    });
}
