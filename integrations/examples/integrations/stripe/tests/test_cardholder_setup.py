import importlib.util
import io
import json
from pathlib import Path
import sys
import unittest
from contextlib import redirect_stdout
from unittest.mock import Mock, patch
from urllib.parse import parse_qs

import stripe

SOURCE = Path(__file__).resolve().parents[1] / 'python' / 'create_cardholder.py'
sys.path.insert(0, str(SOURCE.parent))
spec = importlib.util.spec_from_file_location('cardholder_setup', SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ENV = {'STRIPE_API_KEY': 'sk_test_synthetic', 'STRIPE_TEST_CARDHOLDER_KEY': 'synthetic-holder-1'}


def holder(**updates):
    return stripe.StripeObject.construct_from({
        'id': 'ich_synthetic', 'object': 'issuing.cardholder', 'livemode': False,
        'type': 'individual', 'status': 'active',
        'requirements': {'disabled_reason': None, 'past_due': []}, **updates,
    }, 'sk_test_synthetic')


class CardholderSetupTests(unittest.TestCase):
    def fixture(self):
        client = Mock()
        client.v1.issuing.cardholders.create.return_value = holder()
        client.v1.issuing.cardholders.retrieve.return_value = holder()
        return client, Mock(return_value=client)

    def test_synthetic_payload_verified_then_retrieved(self):
        client, factory = self.fixture()
        result = module.create_cardholder(ENV, factory)
        self.assertEqual(result['id'], 'ich_synthetic')
        payload, options = client.v1.issuing.cardholders.create.call_args.args
        self.assertEqual(options, {'idempotency_key': 'synthetic-holder-1'})
        self.assertEqual(payload['individual'], {'first_name': 'Cookbook', 'last_name': 'Example', 'dob': {'day': 1, 'month': 1, 'year': 1990}})
        self.assertEqual(payload['email'], 'cookbook@example.com')
        self.assertNotIn('user_terms_acceptance', json.dumps(payload))
        self.assertEqual(payload['status'], 'active')
        self.assertEqual(factory.call_args.kwargs['max_network_retries'], 0)
        client.v1.issuing.cardholders.retrieve.assert_called_once_with('ich_synthetic')

    def test_bad_config_prevents_allocation(self):
        for key, values in [('STRIPE_API_KEY', ['', None, 'sk_live_synthetic', 'sk_test_']),
                            ('STRIPE_TEST_CARDHOLDER_KEY', ['', None, 'not stable', 'a'*256])]:
            for value in values:
                with self.subTest(key=key, value=value):
                    client, factory = self.fixture()
                    with self.assertRaises(ValueError): module.create_cardholder({**ENV, key: value}, factory)
                    factory.assert_not_called()

    def test_creation_does_not_imply_eligibility(self):
        for change in [{'id': None}, {'id': 'wrong'}, {'livemode': True}, {'status': 'inactive'}, {'type': 'company'},
                       {'requirements': None}, {'requirements': {}},
                       {'requirements': {'disabled_reason': None, 'past_due': ['individual.card_issuing.user_terms_acceptance.ip']}},
                       {'requirements': {'disabled_reason': 'under_review', 'past_due': []}}]:
            with self.subTest(change=change):
                client, factory = self.fixture()
                client.v1.issuing.cardholders.create.return_value = holder(**change)
                with self.assertRaises(ValueError): module.create_cardholder(ENV, factory)
                client.v1.issuing.cardholders.retrieve.assert_not_called()

    def test_retrieval_must_match_and_remain_eligible(self):
        for change in [{'id': 'ich_other'}, {'livemode': True}, {'status': 'inactive'},
                       {'requirements': {'disabled_reason': None, 'past_due': ['individual.first_name']}}]:
            client, factory = self.fixture()
            client.v1.issuing.cardholders.retrieve.return_value = holder(**change)
            with self.assertRaises(ValueError): module.create_cardholder(ENV, factory)

    def test_provider_error_propagates_without_logging(self):
        for operation in ['create', 'retrieve']:
            client, factory = self.fixture()
            getattr(client.v1.issuing.cardholders, operation).side_effect = RuntimeError('synthetic failure')
            with redirect_stdout(io.StringIO()) as output:
                with self.assertRaises(RuntimeError): module.create_cardholder(ENV, factory)
            self.assertEqual(output.getvalue(), '')

    def test_main_prints_only_verified_id(self):
        with patch.object(module.dotenv, 'load_dotenv'), patch.object(module, 'create_cardholder', return_value=holder()), redirect_stdout(io.StringIO()) as output:
            module.main()
        self.assertEqual(output.getvalue(), 'ich_synthetic\n')

    def test_import_has_no_provider_or_environment_side_effect(self):
        with patch.object(stripe, 'StripeClient') as constructor, patch.object(module.dotenv, 'load_dotenv') as load:
            imported = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(imported)
        constructor.assert_not_called(); load.assert_not_called()

    def test_installed_sdk_serialization(self):
        calls = []

        class Transport(stripe.HTTPClient):
            name = 'synthetic'

            def request(self, method, url, headers, post_data=None, **kwargs):
                calls.append((method, url, headers, post_data))
                return json.dumps(holder().to_dict()), 200, {}

        def factory(api_key, **options):
            return stripe.StripeClient(api_key, max_network_retries=options['max_network_retries'], http_client=Transport())

        module.create_cardholder(ENV, factory)
        self.assertEqual([call[0] for call in calls], ['post', 'get'])
        self.assertTrue(calls[0][1].endswith('/v1/issuing/cardholders'))
        self.assertTrue(calls[1][1].endswith('/v1/issuing/cardholders/ich_synthetic'))
        self.assertEqual(calls[0][2]['Idempotency-Key'], 'synthetic-holder-1')
        body = parse_qs(calls[0][3])
        self.assertEqual(body['individual[dob][year]'], ['1990'])
        self.assertEqual(body['individual[first_name]'], ['Cookbook'])
        self.assertEqual(body['status'], ['active'])
        self.assertFalse(any('acceptance' in key for key in body))


if __name__ == '__main__': unittest.main()
