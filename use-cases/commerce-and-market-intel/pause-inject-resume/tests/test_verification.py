import ast
import asyncio
import os
from pathlib import Path
from types import SimpleNamespace
import unittest

source = Path(os.environ.get('SUMMARY_SOURCE', Path(__file__).resolve().parents[1] / 'src/retail_demo/__main__.py'))
tree = ast.parse(source.read_text())
functions = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in ('verification_errors', '_print_summary')]
namespace = {'RunState': object, 'log': SimpleNamespace(step=lambda *a: None, table=lambda *a: None)}
exec(compile(ast.Module(body=functions, type_ignores=[]), str(source), 'exec'), namespace)

def fixture():
    page = object()
    receipt = dict(token='synthetic', injected=True, recommended_product_id='sku-1', search_applied=True, selected_before=None, cart_added_before=False)
    action = dict(token='synthetic', product_id='sku-1', selected_product_id='sku-1', injected=True, cart_added=True)
    final = dict(injected=True, cart_added=True, cart_status='Added Synthetic to cart.', selected_product_id='sku-1', verification=dict(token='synthetic', action=action))
    return SimpleNamespace(page=page, injection_page=page, injection_receipt=receipt, final_state=final, signal_response=SimpleNamespace(recommended_product_id='sku-1'), stagehand_tool_invocations=0, cache_events=[])

class VerificationTests(unittest.TestCase):
    def test_consistent_observed_sequence(self):
        self.assertEqual(namespace['verification_errors'](fixture()), [])

    def test_missing_or_contradictory_evidence(self):
        for field, value in [('injected', False), ('cart_added', False), ('cart_status', 'Cart is empty'), ('selected_product_id', 'other'), ('verification', None), ('verification', 'malformed')]:
            with self.subTest(field=field):
                state = fixture(); state.final_state[field] = value
                self.assertTrue(namespace['verification_errors'](state))

    def test_before_injection_and_receipt_checks(self):
        for field, value in [('token', None), ('recommended_product_id', 'other'), ('search_applied', False), ('selected_before', 'sku-1'), ('cart_added_before', True)]:
            with self.subTest(field=field):
                state = fixture(); state.injection_receipt[field] = value
                self.assertTrue(namespace['verification_errors'](state))

    def test_stale_missing_or_wrong_action(self):
        for field, value in [('token', 'old'), ('product_id', 'other'), ('injected', False), ('cart_added', False)]:
            state = fixture(); state.final_state['verification']['action'][field] = value
            self.assertTrue(namespace['verification_errors'](state))
        state = fixture(); state.injection_page = object()
        self.assertTrue(namespace['verification_errors'](state))

    def test_actual_summary_exit_status(self):
        async def pages(): return [object()]
        async def metrics(): return SimpleNamespace(model_dump=lambda: {'total_prompt_tokens': 1})
        stagehand = SimpleNamespace(browser=SimpleNamespace(context=SimpleNamespace(pages=pages)), metrics=metrics)
        for valid in [True, False]:
            state = fixture()
            if not valid: state.final_state['injected'] = False
            self.assertEqual(asyncio.run(namespace['_print_summary'](stagehand, state)), 0 if valid else 1)

class InjectionReceiptTests(unittest.TestCase):
    def test_actual_tool_keeps_only_valid_current_receipt(self):
        tool_source = Path(__file__).resolve().parents[1] / 'src/retail_demo/stagehand_tools/mcp.py'
        node = next(x for x in ast.parse(tool_source.read_text()).body if isinstance(x, ast.FunctionDef) and x.name == 'make_inject_signals_tool')
        async def pause(*args): pass
        for valid in [True, False]:
            async def evaluate(token):
                return {'injected': valid, 'token': token}
            page = SimpleNamespace(evaluate=evaluate)
            state = SimpleNamespace(signal_response=SimpleNamespace(recommended_product_id='sku-1', model_dump=lambda **kw: {}),
                stagehand_tool_invocations=0, final_state={'stale': True}, injection_receipt={'old': True}, injection_page=object(), require_page=lambda: page)
            ns = dict(Stagehand=object, RunState=object, Config=object, Any=object, tool=lambda *a: lambda fn: fn,
                uuid4=lambda: 'synthetic', inject_signals_expression=lambda response, token: token,
                error_result=lambda text: {'error': text}, text_result=lambda value: value,
                log=SimpleNamespace(tool_call=lambda *a: None, pause=pause))
            exec(compile(ast.Module(body=[node], type_ignores=[]), str(tool_source), 'exec'), ns)
            fn = ns['make_inject_signals_tool'](None, state, SimpleNamespace(step_delay_ms=0))
            asyncio.run(fn({}))
            self.assertIsNone(state.final_state)
            if valid:
                self.assertEqual(state.injection_receipt['token'], 'synthetic')
                self.assertIs(state.injection_page, page)
            else:
                self.assertIsNone(state.injection_receipt)
                self.assertIsNone(state.injection_page)

if __name__ == '__main__': unittest.main()
