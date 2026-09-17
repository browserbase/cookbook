import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

function verifyCard(card: Stripe.Issuing.Card, cardholderId: string, status: 'inactive' | 'active', expectedId?: string) {
    const holder = typeof card.cardholder === 'string' ? card.cardholder : card.cardholder?.id;
    if (!/^ic_[A-Za-z0-9]+$/.test(card.id) || (expectedId && card.id !== expectedId)
        || card.livemode !== false || holder !== cardholderId || card.status !== status) {
        throw new Error('Test card state could not be verified.');
    }
}

async function createCard(cardholderId = process.env.STRIPE_CARDHOLDER_ID) {
    const apiKey = process.env.STRIPE_API_KEY;
    if (!apiKey?.startsWith('sk_test_') || apiKey.length <= 'sk_test_'.length) {
        throw new Error('STRIPE_API_KEY must be a test secret key.');
    }
    if (!cardholderId || !/^ich_[A-Za-z0-9]+$/.test(cardholderId)) {
        throw new Error('STRIPE_CARDHOLDER_ID must be an explicit cardholder ID.');
    }
    const stripe = new Stripe(apiKey);
    const cardholder = await stripe.issuing.cardholders.retrieve(cardholderId);
    if (cardholder.id !== cardholderId || cardholder.livemode !== false || cardholder.status !== 'active'
        || !cardholder.requirements || cardholder.requirements.disabled_reason !== null
        || !Array.isArray(cardholder.requirements.past_due) || cardholder.requirements.past_due.length !== 0) {
        throw new Error('Test cardholder is not ready to issue cards.');
    }
    const card = await stripe.issuing.cards.create({
        cardholder: cardholderId,
        currency: 'usd',
        type: 'virtual',
        status: 'inactive',
        spending_controls: {
            allowed_categories: ['charitable_and_social_service_organizations_fundraising'],
            spending_limits: [{ amount: 7500, interval: 'daily' }],
        },
    });
    verifyCard(card, cardholderId, 'inactive');
    if (process.env.STRIPE_ACTIVATE_TEST_CARD !== 'true') {
        console.log('Test card created inactive:', card.id);
        return card;
    }
    await stripe.issuing.cards.update(card.id, { status: 'active' });
    const activeCard = await stripe.issuing.cards.retrieve(card.id);
    verifyCard(activeCard, cardholderId, 'active', card.id);
    console.log('Test card verified active:', activeCard.id);
    return activeCard;
}

createCard().catch(() => {
    console.error('Test card setup failed; inspect its state before retrying.');
    process.exitCode = 1;
});
