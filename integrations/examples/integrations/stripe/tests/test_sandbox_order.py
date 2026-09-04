import importlib.util
import io
import json
from urllib.parse import parse_qs
import os
from pathlib import Path
import sys
from types import SimpleNamespace as NS
import unittest
from unittest.mock import Mock, patch
from contextlib import redirect_stdout

import stripe

SOURCE = Path(__file__).resolve().parents[1] / 'python' / 'make-payment.py'
sys.path.insert(0, str(SOURCE.parent))
spec = importlib.util.spec_from_file_location('sandbox_order', SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ENV = dict(STRIPE_API_KEY='sk_test_synthetic', STRIPE_CARD_ID='ic_synthetic',
           STRIPE_CARDHOLDER_ID='ich_synthetic', STRIPE_TEST_AUTHORIZATION_KEY='synthetic-order-1',
           BROWSERBASE_API_KEY='synthetic', BROWSERBASE_PROJECT_ID='synthetic')


def obj(value):
    return stripe.StripeObject.construct_from(value, 'sk_test_synthetic')


def fixture():
    card = obj(dict(id='ic_synthetic', cardholder='ich_synthetic', livemode=False, status='active'))
    holder = obj(dict(id='ich_synthetic', livemode=False, status='active',
                      requirements=dict(disabled_reason=None, past_due=[])))
    authorization = obj(dict(id='iauth_synthetic', card='ic_synthetic', cardholder='ich_synthetic',
                             amount=1000, currency='usd', approved=True, status='pending', livemode=False))
    client = Mock()
    client.v1.issuing.cards.retrieve.return_value = card
    client.v1.issuing.cardholders.retrieve.return_value = holder
    client.v1.test_helpers.issuing.authorizations.create.return_value = authorization
    bb = Mock()
    bb.sessions.create.return_value = NS(id='session-synthetic', connect_url='ws://synthetic.invalid')
    page = Mock()
    page.locator.return_value.evaluate.return_value = dict(amount='1000', currency='usd', nonce='synthetic-nonce', text='Test order confirmed')
    browser = Mock(contexts=[Mock()])
    browser.contexts[0].new_page.return_value = page
    playwright = Mock()
    playwright.chromium.connect_over_cdp.return_value = browser
    return NS(client=client, bb=bb, page=page, browser=browser, playwright=playwright,
              stripe_factory=Mock(return_value=client), bb_factory=Mock(return_value=bb),
              card=card, holder=holder, authorization=authorization)


class SandboxOrderTests(unittest.TestCase):
    def run_fixture(self, f, env=None):
        with patch.object(module.uuid, 'uuid4', return_value='synthetic-nonce'), redirect_stdout(io.StringIO()) as output:
            module.run(f.playwright, ENV if env is None else env, f.stripe_factory, f.bb_factory)
        return output.getvalue()

    def test_success_uses_metadata_and_idempotent_test_authorization(self):
        f = fixture()
        self.assertIn('approved and pending', self.run_fixture(f))
        f.client.v1.issuing.cards.retrieve.assert_called_once_with('ic_synthetic')
        args, kwargs = f.client.v1.test_helpers.issuing.authorizations.create.call_args
        self.assertEqual(args[0], dict(card='ic_synthetic', amount=1000, currency='usd', authorization_method='online',
                                      merchant_data=dict(category='charitable_and_social_service_organizations_fundraising', name='Cookbook Sandbox', country='US')))
        self.assertEqual(args[1], dict(idempotency_key='synthetic-order-1'))
        f.bb_factory.assert_called_once_with(api_key='synthetic', timeout=30, max_retries=0)
        f.bb.sessions.create.assert_called_once_with(project_id='synthetic', api_timeout=300)
        f.browser.close.assert_called_once()
        f.bb.sessions.update.assert_called_once_with('session-synthetic', project_id='synthetic', status='REQUEST_RELEASE')
        self.assertEqual(f.stripe_factory.call_args.kwargs['max_network_retries'], 0)

    def test_config_rejected_before_client_allocation(self):
        for key in ENV:
            for value in ('', None):
                with self.subTest(key=key, value=value):
                    f = fixture()
                    with self.assertRaises(ValueError): self.run_fixture(f, {**ENV, key: value})
                    f.stripe_factory.assert_not_called()
                    f.bb_factory.assert_not_called()
        for key, value in [('STRIPE_API_KEY', 'sk_live_bad'), ('STRIPE_CARD_ID', 'other'), ('STRIPE_TEST_AUTHORIZATION_KEY', 'spaces invalid')]:
            with self.assertRaises(ValueError): module.read_config({**ENV, key: value})

    def test_unusable_card_or_holder_stops_before_browser(self):
        for target, key, value in [('card','id','ic_other'), ('card','status','inactive'), ('card','livemode',True),
                                    ('card','cardholder','ich_other'), ('holder','status','inactive'),
                                    ('holder','requirements', {'disabled_reason': 'requirements.past_due', 'past_due': ['name']})]:
            with self.subTest(target=target, key=key):
                f = fixture(); getattr(f,target)[key] = value
                with self.assertRaises(ValueError): self.run_fixture(f)
                f.bb_factory.assert_not_called()

    def test_receipt_tampering_never_authorizes(self):
        for key in ('amount','currency','nonce','text'):
            f = fixture(); f.page.locator.return_value.evaluate.return_value[key] = 'wrong'
            with self.assertRaises(ExceptionGroup): self.run_fixture(f)
            f.client.v1.test_helpers.issuing.authorizations.create.assert_not_called()
            f.browser.close.assert_called_once(); f.bb.sessions.update.assert_called_once()

    def test_invalid_authorization_is_failure(self):
        for key, value in [('id',None),('card','ic_other'),('cardholder','ich_other'),('livemode',True),
                           ('amount',1001),('amount',1000.0),('currency','eur'),('approved',False),('status','closed')]:
            with self.subTest(key=key, value=value):
                f=fixture(); f.authorization[key]=value
                with self.assertRaises(ExceptionGroup): self.run_fixture(f)
                f.bb.sessions.update.assert_called_once()

    def test_expanded_objects_supported(self):
        f=fixture(); f.card['cardholder']=obj({'id':'ich_synthetic'})
        f.authorization['card']=obj({'id':'ic_synthetic'})
        f.authorization['cardholder']=obj({'id':'ich_synthetic'})
        self.run_fixture(f)

    def test_connect_failure_releases_session(self):
        f=fixture(); f.playwright.chromium.connect_over_cdp.side_effect=RuntimeError('connect')
        with self.assertRaises(ExceptionGroup): self.run_fixture(f)
        f.browser.close.assert_not_called(); f.bb.sessions.update.assert_called_once()

    def test_independent_cleanup_and_no_false_success(self):
        f=fixture(); f.browser.close.side_effect=RuntimeError('close'); f.bb.sessions.update.side_effect=RuntimeError('release')
        with self.assertRaises(ExceptionGroup) as raised: self.run_fixture(f)
        self.assertEqual(len(raised.exception.exceptions),2)
        f.bb.sessions.update.assert_called_once()

    def test_browser_and_provider_errors_release(self):
        for operation in ('content','click','create'):
            f=fixture()
            target = {'content':f.page.set_content, 'click':f.page.locator.return_value.click,
                      'create':f.client.v1.test_helpers.issuing.authorizations.create}[operation]
            target.side_effect=RuntimeError(operation)
            with self.assertRaises(ExceptionGroup): self.run_fixture(f)
            f.browser.close.assert_called_once(); f.bb.sessions.update.assert_called_once()

    def test_installed_stripe_transport_contract(self):
        f = fixture()
        calls = []

        class Transport(stripe.HTTPClient):
            name = 'synthetic'

            def request(self, method, url, headers, post_data=None, **kwargs):
                calls.append((method, url, headers, post_data))
                if url.endswith('/issuing/cards/ic_synthetic'):
                    data = dict(f.card.to_dict(), object='issuing.card')
                elif url.endswith('/issuing/cardholders/ich_synthetic'):
                    data = dict(f.holder.to_dict(), object='issuing.cardholder')
                elif url.endswith('/test_helpers/issuing/authorizations'):
                    data = dict(f.authorization.to_dict(), object='issuing.authorization')
                else:
                    raise AssertionError('Unexpected SDK endpoint')
                return json.dumps(data), 200, {}

        def factory(api_key, **options):
            return stripe.StripeClient(api_key, max_network_retries=options['max_network_retries'], http_client=Transport())

        f.stripe_factory = factory
        self.run_fixture(f)
        self.assertEqual([call[0] for call in calls], ['get', 'get', 'post'])
        self.assertEqual(calls[-1][2]['Idempotency-Key'], 'synthetic-order-1')
        body = parse_qs(calls[-1][3])
        self.assertEqual(body['amount'], ['1000'])
        self.assertEqual(body['card'], ['ic_synthetic'])
        self.assertEqual(body['merchant_data[category]'], ['charitable_and_social_service_organizations_fundraising'])
        self.assertNotIn('expand', calls[0][1])

    def test_nonce_injection_rejected(self):
        with self.assertRaises(ValueError): module.checkout_html("'</script>")

    @unittest.skipUnless(os.getenv('COOKBOOK_CHROME'), 'Set COOKBOOK_CHROME for isolated local Chromium fixture')
    def test_real_local_browser_checkout(self):
        f=fixture()
        with module.sync_playwright() as playwright:
            browser=playwright.chromium.launch(executable_path=os.environ['COOKBOOK_CHROME'], headless=True)
            browser.new_context()
            f.playwright.chromium.connect_over_cdp.return_value=browser
            try: self.run_fixture(f)
            finally: browser.close()
        f.client.v1.test_helpers.issuing.authorizations.create.assert_called_once()


if __name__ == '__main__': unittest.main()
