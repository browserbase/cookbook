import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).resolve().parents[1] / 'scripts/catalog.py'
SPEC = importlib.util.spec_from_file_location('cookbook_catalog', MODULE_PATH)
catalog = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(catalog)


class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.recipes = catalog.catalog()

    def test_use_case_index_has_no_stale_or_missing_targets(self):
        routed = {
            recipe['path']
            for recipe in self.recipes
            if recipe['collection'] == 'use-cases'
        }
        index_path = catalog.ROOT / 'use-cases/catalog.json'
        if not index_path.is_file():
            self.assertEqual(routed, set())
            return
        index = json.loads(index_path.read_text())
        for workflow in index['workflows']:
            path = 'use-cases/' + workflow['path']
            with self.subTest(path=path):
                self.assertIn(path, routed)
                self.assertTrue((catalog.ROOT / path).is_dir())
                self.assertTrue(any((catalog.ROOT / path).glob('*README*.md')))

    def test_url_required_recipes_have_runnable_documented_arguments(self):
        import shlex
        from urllib.parse import urlsplit
        recipes = {r['id']: r for r in self.recipes}
        generated = catalog.generated(self.recipes)
        for language, prefix in [('python', ['uv', 'run', 'python', 'main.py']),
                                 ('typescript', ['pnpm', 'start'])]:
            for topic in ['image-url-download', 'smart-fetch-scraper']:
                recipe = recipes[f'examples-{language}-{topic}']
                with self.subTest(recipe=recipe['id']):
                    self.assertEqual(len(recipe['run_commands']), 1)
                    command = recipe['run_commands'][0]
                    argv = shlex.split(command)
                    self.assertEqual(argv[:-1], prefix)
                    self.assertEqual(urlsplit(argv[-1]).scheme, 'https')
                    self.assertTrue(urlsplit(argv[-1]).netloc)
                    self.assertIn(command, generated[recipe['readme']])

    def test_environment_metadata_is_complete_and_guides_separate_requirements(self):
        for recipe in self.recipes:
            for item in recipe['environment_variables']:
                self.assertEqual(set(item), catalog.ENVIRONMENT_FIELDS)
        recipe = next(r for r in self.recipes if any(
            item['requirement'] == 'required' for item in r['environment_variables']))
        guide = catalog.guide(recipe)
        self.assertIn('### Required', guide)
        self.assertIn('Provider and purpose', guide)
        self.assertNotIn('not a claim that every name is mandatory', guide)

    def test_project_id_is_not_a_recipe_requirement(self):
        deprecated_name = "BROWSERBASE" + "_PROJECT_ID"
        for recipe in self.recipes:
            names = {item["name"] for item in recipe["environment_variables"]}
            with self.subTest(recipe=recipe["id"]):
                self.assertNotIn(deprecated_name, names)

    def test_every_generated_recipe_has_demo_only_disclaimer(self):
        for recipe in self.recipes:
            with self.subTest(recipe=recipe['id']):
                guide = catalog.guide(recipe)
                self.assertIn('Demo and reference code only.', guide)
                self.assertIn('not a vetted production implementation', guide)
                self.assertIn('Use at your own risk.', guide)

    def test_entrypoint_docs_display_demo_only_disclaimer(self):
        for relative in ('README.md', 'docs/getting-started.md',
                         'skills/browserbase-cookbook/SKILL.md'):
            with self.subTest(path=relative):
                text = (catalog.ROOT / relative).read_text()
                self.assertRegex(text, r'(?i)demo(?: and |/)reference')
                self.assertRegex(text, r'(?i)vetted')
                self.assertIn('Use at your own risk.', text)

    def test_invalid_environment_metadata_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            recipe = dict(self.recipes[0])
            recipe['environment_variables'] = [{'name': 'BROWSERBASE_API_KEY'}]
            (root / 'catalog.json').write_text(json.dumps({'schema_version': 1, 'recipes': [recipe]}))
            with patch.object(catalog, 'ROOT', root):
                with self.assertRaisesRegex(ValueError, 'environment metadata fields'):
                    catalog.catalog()

    def test_node_boundary_validation_rejects_engine_and_documentation_drift(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manifest = root / 'integrations/examples/integrations/mastra/package.json'
            manifest.parent.mkdir(parents=True)
            manifest.write_text(json.dumps({'engines': {'node': '>=24.19.0'}}))
            readme = manifest.parent / 'README.md'
            readme.write_text('Requires Node.js 24.19.0.')
            with patch.object(catalog, 'ROOT', root):
                catalog.validate_node_boundaries()
                manifest.write_text(json.dumps({'engines': {'node': '>=22'}}))
                with self.assertRaisesRegex(ValueError, 'Node 24.19.0'):
                    catalog.validate_node_boundaries()

    def test_stronger_verification_is_backed_by_dated_limited_evidence(self):
        recipes = {recipe['id']: recipe for recipe in self.recipes}
        python = recipes['examples-python-getting-started-with-browserbase']
        typescript = recipes['examples-typescript-getting-started-with-browserbase']
        self.assertEqual(python['verification'], 'install-verified')
        self.assertEqual(typescript['verification'], 'offline-tested')
        guide = catalog.guide(typescript)
        self.assertIn('Offline behavior tested', guide)
        self.assertIn('no network or authenticated service was used', guide)

    def test_invalid_or_unsubstantiated_verification_evidence_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            recipe = dict(self.recipes[0], verification='live-tested', verification_evidence=[])
            recipe['readme'] = 'docs/recipes/' + recipe['id'] + '.md'
            (root / 'catalog.json').write_text(json.dumps({'schema_version': 1, 'recipes': [recipe]}))
            with patch.object(catalog, 'ROOT', root):
                with self.assertRaisesRegex(ValueError, 'lacks passing evidence'):
                    catalog.catalog()
            recipe['verification_evidence'] = [{
                'kind': 'live-tested', 'date': 'yesterday', 'runtime': 'Node 24',
                'command': 'npm start', 'result': 'passed', 'limits': 'One account.',
            }]
            (root / 'catalog.json').write_text(json.dumps({'schema_version': 1, 'recipes': [recipe]}))
            with patch.object(catalog, 'ROOT', root):
                with self.assertRaisesRegex(ValueError, 'date'):
                    catalog.catalog()

    def test_dependency_metadata_detects_version_and_removal_drift(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manifest = root / 'package.json'
            manifest.write_text(json.dumps({'dependencies': {'stagehand': '4.0.2'}, 'devDependencies': {'typescript': '7'}}))
            recipe = {'id': 'fixture', 'manifests': ['package.json'], 'dependencies': {'stagehand': '2', 'removed': '1'}}
            with patch.object(catalog, 'ROOT', root):
                self.assertEqual(catalog.dependency_drift([recipe]), {'fixture': {'stagehand': '4.0.2'}})
                recipe['dependencies'] = {'stagehand': '4.0.2'}
                self.assertEqual(catalog.dependency_drift([recipe]), {})
                manifest.write_text(json.dumps({'dependencies': {'stagehand': '5'}}))
                self.assertIn('fixture', catalog.dependency_drift([recipe]))

    def test_python_primary_manifest_precedence_and_markers(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'pyproject.toml').write_text('[project]\ndependencies = ' + json.dumps(['stagehand==4', 'requests; python_version >= "3.11"']) + '\n')
            (root / 'requirements.txt').write_text('stagehand==2\n')
            recipe = {'id': 'fixture', 'manifests': ['requirements.txt', 'pyproject.toml'], 'dependencies': []}
            with patch.object(catalog, 'ROOT', root):
                self.assertEqual(catalog.declared_dependencies(recipe), ['requests; python_version >= "3.11"', 'stagehand==4'])
                recipe['manifests'] = ['requirements.txt']
                (root / 'requirements.txt').write_text('requests>=2 # comment\n# ignored\n')
                self.assertEqual(catalog.declared_dependencies(recipe), ['requests>=2'])
                (root / 'requirements.txt').write_text('-r https://example.invalid/requirements.txt\n')
                with self.assertRaises(ValueError):
                    catalog.declared_dependencies(recipe)

    def test_explicit_primary_preserves_other_package_dependencies(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for name, version in [('agent', '4'), ('app', '2')]:
                (root / name).mkdir()
                (root / name / 'package.json').write_text(json.dumps({'dependencies': {'library': version}}))
            recipe = dict(self.recipes[0], manifests=['agent/package.json', 'app/package.json'],
                          primary_manifest='agent/package.json', dependencies={'library': '4'})
            with patch.object(catalog, 'ROOT', root):
                self.assertEqual(catalog.dependency_drift([recipe]), {})
                guide = catalog.guide(recipe)
                self.assertIn('| `library` | `2` |', guide)
                (root / 'app/package.json').write_text(json.dumps({'dependencies': {'library': '3'}}))
                self.assertNotEqual(catalog.guide(recipe), guide)
                recipe['primary_manifest'] = 'missing/package.json'
                with self.assertRaises(ValueError):
                    catalog.primary_dependency_manifest(recipe)
                del recipe['primary_manifest']
                with self.assertRaises(ValueError):
                    catalog.primary_dependency_manifest(recipe)

    def test_new_working_directory_manifest_cannot_be_silently_omitted(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            recipe = {'id': 'fixture', 'working_directory': '.', 'manifests': [], 'dependencies': {}}
            with patch.object(catalog, 'ROOT', root):
                self.assertEqual(catalog.dependency_drift([recipe]), {})
                (root / 'requirements.txt').write_text('browserbase==1\n')
                with self.assertRaisesRegex(ValueError, 'Unrecorded working-directory manifests'):
                    catalog.dependency_drift([recipe])
                recipe['manifests'] = ['requirements.txt']
                self.assertEqual(catalog.dependency_drift([recipe]), {'fixture': ['browserbase==1']})

    def test_catalog_rejects_routes_to_deleted_demo_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            demo = root / 'examples/deleted-demo'
            demo.mkdir(parents=True)
            recipe = dict(
                self.recipes[0],
                id='deleted-demo',
                path='examples/deleted-demo',
                working_directory='examples/deleted-demo',
                readme='docs/recipes/deleted-demo.md',
                upstream_readme=None,
                entrypoints=['examples/deleted-demo/main.py'],
                manifests=[],
                environment_template=None,
            )
            (root / 'catalog.json').write_text(
                json.dumps({'schema_version': 1, 'recipes': [recipe]})
            )
            with patch.object(catalog, 'ROOT', root):
                with self.assertRaisesRegex(ValueError, 'Missing entrypoints route target'):
                    catalog.catalog()

    def test_inherited_legacy_label_does_not_outweigh_task_match(self):
        common = dict(self.recipes[0], access='public', languages=['python'], frameworks=[], topics=[], tags=[])
        exact = dict(common, id='legacy-exact', title='persistent login', summary='', lifecycle='legacy', collection='playbook')
        vague = dict(common, id='current-vague', title='Generic example', summary='persistent login', lifecycle='current', collection='examples')
        matches = catalog.search([vague, exact], 'persistent login', 'python', 2)
        self.assertEqual(matches[0]['id'], 'legacy-exact')
        exact['lifecycle'] = 'current'
        self.assertEqual([r['id'] for r in catalog.search([vague, exact], 'persistent login', 'python', 2)], [r['id'] for r in matches])

    def test_declared_dependency_mirrors_reject_divergence(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'pyproject.toml').write_text('[project]\ndependencies = ["pydantic>=2,<3"]\n')
            (root / 'requirements.txt').write_text('pydantic>=2,<3\n')
            recipe = dict(id='fixture', manifests=['pyproject.toml', 'requirements.txt'],
                          matching_dependency_manifests=True, dependencies=['pydantic>=2,<3'])
            with patch.object(catalog, 'ROOT', root):
                self.assertEqual(catalog.dependency_drift([recipe]), {})
                (root / 'requirements.txt').write_text('pydantic\n')
                with self.assertRaisesRegex(ValueError, 'Dependency mirrors disagree'):
                    catalog.dependency_drift([recipe])

    def test_go_require_metadata_excludes_indirect_and_detects_drift(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = 'module fixture\ngo 1.26\nrequire example.org/sdk v4.0.2\nrequire (\n example.org/helper v1.0.0 // indirect\n example.org/direct v2.0.0\n)\n'
            manifest = root / 'go.mod'
            manifest.write_text(source)
            recipe = dict(id='fixture', manifests=['go.mod'], dependencies={})
            with patch.object(catalog, 'ROOT', root):
                self.assertEqual(catalog.dependency_drift([recipe]), {'fixture': {'example.org/sdk': 'v4.0.2', 'example.org/direct': 'v2.0.0'}})
                manifest.write_text(source + 'replace example.org/sdk => ../sdk\n')
                with self.assertRaisesRegex(ValueError, 'replacements'):
                    catalog.declared_dependencies(recipe)

    def test_language_filter_routes_to_python_context(self):
        matches = catalog.search(self.recipes, 'persistent login', 'python', 5)
        self.assertTrue(matches)
        self.assertTrue(all('python' in recipe['languages'] for recipe in matches))
        self.assertEqual(matches[0]['id'], 'examples-python-context')

    def test_human_handoff_routes_to_interactive_agent(self):
        matches = catalog.search(self.recipes, 'human handoff', None, 1)
        self.assertEqual(matches[0]['id'], 'examples-python-human-in-the-loop')

    def test_no_match_does_not_invent_recommendations(self):
        self.assertEqual(catalog.search(self.recipes, 'zzzxxyy', None, 5), [])

    def test_search_defaults_to_public_and_private_is_opt_in(self):
        public = dict(self.recipes[0], id='public-fit', access='public', title='Exact private task', summary='')
        private = dict(public, id='private-fit', access='private')
        self.assertEqual([r['id'] for r in catalog.search([private, public], 'exact private task', None, 5)], ['public-fit'])
        self.assertEqual({r['id'] for r in catalog.search([private, public], 'exact private task', None, 5, 'any')}, {'public-fit', 'private-fit'})

    def test_no_llm_constraint_routes_to_direct_browser_recipe(self):
        common = dict(self.recipes[0], access='public', languages=['typescript'], topics=[], tags=[], environment_variables=[])
        stagehand = dict(common, id='stagehand-cache', title='Basic caching', summary='cache a browser action', frameworks=['stagehand'])
        playwright = dict(common, id='raw-playwright', title='Raw Playwright browser', summary='browser automation', frameworks=['playwright', 'browserbase'])
        matches = catalog.search([stagehand, playwright], 'raw playwright without an LLM', 'typescript', 5)
        self.assertEqual([r['id'] for r in matches], ['raw-playwright'])
        self.assertGreater(matches[0]['search_score'], 0)

    def test_common_discovery_phrases_route_to_relevant_recipes(self):
        cases = {
            "upload file": "playbook-node-playwright-tools-uploads-local-upload",
            "session replay": "examples-python-getting-started-with-browserbase",
            "live debug URL": "playbook-node-playwright-tools-context-initialize-context",
            "connect over CDP": "playbook-node-playwright-tools-context-initialize-context",
            "raw Playwright": "examples-typescript-getting-started-with-browserbase",
        }
        for query, expected in cases.items():
            with self.subTest(query=query):
                matches = catalog.search(self.recipes, query, None, 10)
                self.assertIn(expected, [recipe["id"] for recipe in matches])
        insurance = dict(self.recipes[0], id="restricted-insurance", access="private",
                         title="Nurse License Verification", summary="Search public records",
                         topics=["business-operations"], tags=["healthcare"], frameworks=[])
        private_matches = catalog.search([insurance], "insurance verification", None, 10, "any")
        self.assertEqual([recipe["id"] for recipe in private_matches], ["restricted-insurance"])

    def test_reported_discovery_queries_rank_the_intended_public_recipe(self):
        cases = {
            'flight': 'playbook-node-playwright-research-searchalaskaflights',
            'playwright python': 'examples-python-playwright-quickstart-playwright',
            'payment': 'integrations-examples-integrations-stripe-node',
            'openai': 'examples-python-openai-cua',
            'claude': 'examples-python-anthropic-cua',
            'proxy residential': 'examples-python-proxies',
            'insurance verification': 'examples-python-license-verification',
        }
        for query, expected in cases.items():
            with self.subTest(query=query):
                matches = catalog.search(self.recipes, query, None, 5)
                self.assertTrue(matches)
                self.assertEqual(matches[0]['id'], expected)
        cua = {recipe['id'] for recipe in catalog.search(self.recipes, 'computer use', None, 10)}
        self.assertIn('examples-python-gemini-cua', cua)
        self.assertIn('examples-python-openai-cua', cua)
        self.assertIn('examples-python-anthropic-cua', cua)

    def test_featured_starting_points_have_environment_templates_and_launch_commands(self):
        recipes = {recipe['id']: recipe for recipe in self.recipes}
        for recipe_id in (
            'examples-typescript-agent-with-human-in-loop',
            'examples-go-hackernews',
            'examples-python-human-in-the-loop',
            'examples-python-file-upload',
            'examples-python-openai-cua',
            'examples-python-anthropic-cua',
            'integrations-examples-integrations-agentkit-browserbase',
        ):
            with self.subTest(recipe=recipe_id):
                recipe = recipes[recipe_id]
                self.assertTrue(recipe['run_commands'])
                self.assertTrue(recipe['environment_template'])
                self.assertTrue((catalog.ROOT / recipe['environment_template']).is_file())

    def test_private_references_are_not_advertised_as_runnable_dumps(self):
        for recipe in self.recipes:
            if recipe['access'] != 'private':
                continue
            with self.subTest(recipe=recipe['id']):
                self.assertFalse(recipe['summary'].startswith('Private source-inspected example for '))
                if catalog.recipe_type(recipe) == 'runnable example':
                    self.assertTrue(recipe.get('upstream_readme'))
                    self.assertTrue(recipe.get('environment_template'))
                    self.assertTrue((catalog.ROOT / recipe['upstream_readme']).is_file())
                    self.assertTrue((catalog.ROOT / recipe['environment_template']).is_file())
                if recipe.get('recipe_type') == 'reference':
                    self.assertFalse(recipe['run_commands'])

    def test_live_evidence_and_unverified_guides_use_distinct_language(self):
        live = next(recipe for recipe in self.recipes if recipe['verification'] == 'live-tested')
        live_guide = catalog.guide(live)
        self.assertIn('A scoped live workflow check is recorded below', live_guide)
        self.assertNotIn('No passing authenticated live-workflow check', live_guide)
        unverified = next(recipe for recipe in self.recipes if recipe['verification'] == 'source-inspected')
        self.assertIn('No passing authenticated live-workflow check is recorded', catalog.guide(unverified))

    def test_cookbook_authored_recipe_provenance_is_not_an_upstream_claim(self):
        recipe = next(recipe for recipe in self.recipes if recipe['id'] == 'examples-python-openai-cua')
        guide = catalog.guide(recipe)
        self.assertIn('Cookbook-authored example.', guide)
        self.assertNotIn('Pinned upstream source', guide)

    def test_conditional_model_keys_do_not_make_an_llm_mandatory(self):
        direct = dict(self.recipes[0], id="direct-browser", title="Direct browser",
                      summary="Browser automation", environment_variables=[
            {"name": "MODEL_API_KEY", "requirement": "conditional"}
        ], frameworks=["playwright", "browserbase"])
        self.assertEqual(catalog.llm_requirement(direct), "not required")

    def test_partial_matches_are_not_presented_as_complete(self):
        recipe = dict(self.recipes[0], access='public', title='Upload a document', summary='', frameworks=[])
        self.assertEqual(catalog.search([recipe], 'upload spending limit', None, 5), [])

    def test_search_filters_lifecycle_and_recipe_type(self):
        runnable = dict(self.recipes[0], access='public', lifecycle='current', title='Browser task', run_commands=['python main.py'])
        snippet = dict(runnable, id='snippet', lifecycle='legacy', run_commands=[], entrypoints=['helper.py'])
        self.assertEqual(catalog.recipe_type(runnable), 'runnable example')
        self.assertEqual(catalog.recipe_type(snippet), 'reusable snippet')
        self.assertEqual([r['id'] for r in catalog.search([snippet, runnable], 'browser task', None, 5, 'public', 'legacy', 'reusable snippet')], ['snippet'])

    def test_every_recipe_is_reachable_from_installed_references(self):
        output = catalog.generated(self.recipes)
        for recipe in self.recipes:
            with self.subTest(recipe=recipe['id']):
                self.assertTrue(any('`' + recipe['readme'] + '`' in output['skills/browserbase-cookbook/references/' + topic + '.md'] for topic in recipe['topics']))

    def test_collection_tables_preserve_editorial_text(self):
        output = catalog.generated(self.recipes)
        for collection in ['examples', 'integrations', 'playbook', 'use-cases']:
            name = collection + '/README.md'
            existing = (catalog.ROOT / name).read_text()
            self.assertEqual(output[name].split('<!-- recipes:start -->')[0], existing.split('<!-- recipes:start -->')[0])
            self.assertEqual(output[name].split('<!-- recipes:end -->')[1], existing.split('<!-- recipes:end -->')[1])
            for recipe in self.recipes:
                if recipe['collection'] == collection:
                    self.assertIn(catalog.link(recipe['readme'], name), output[name])

    def test_stats_alt_tracks_catalog_and_preserves_readme_prose(self):
        from html.parser import HTMLParser
        class Images(HTMLParser):
            def handle_starttag(self, tag, attrs):
                attrs = dict(attrs)
                if tag == 'img' and attrs.get('src') == 'assets/cookbook-stats.svg':
                    self.alt = attrs.get('alt')
        original = 'Before\n<!-- cookbook-stats:start --><!-- cookbook-stats:end -->\nAfter\n'
        read_text = Path.read_text
        def read_with_stats(path, *args, **kwargs):
            if path == catalog.ROOT / 'README.md':
                return original
            return read_text(path, *args, **kwargs)
        with patch.object(Path, 'read_text', read_with_stats):
            for recipes in [self.recipes, self.recipes[:1], []]:
              with self.subTest(count=len(recipes)):
                output = catalog.generated(recipes)
                parser = Images()
                parser.feed(output['README.md'])
                expected = (f'Cookbook catalog: {len(recipes)} recipes, {len(catalog.TOPICS)} topics, '
                            f'{len({v for r in recipes for v in r["languages"]})} languages, '
                            f'{len({r["collection"] for r in recipes})} collections')
                self.assertEqual(parser.alt, expected)
                self.assertIn('<title id="title">' + expected + '</title>', output['assets/cookbook-stats.svg'])
                for marker, part in [('<!-- cookbook-stats:start -->', 0), ('<!-- cookbook-stats:end -->', 1)]:
                    self.assertEqual(output['README.md'].split(marker)[part], original.split(marker)[part])

    def test_stats_block_is_optional(self):
        output = catalog.generated(self.recipes)
        self.assertEqual(output['README.md'], (catalog.ROOT / 'README.md').read_text())
        self.assertNotIn('assets/cookbook-stats.svg', output)

    def test_hostile_recipe_path_rejected_before_any_write(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            root = folder / 'checkout'
            root.mkdir()
            (root / 'README.md').write_text('<!-- cookbook-stats:start --><!-- cookbook-stats:end -->')
            for collection in ['examples', 'integrations', 'playbook', 'use-cases']:
                landing = root / collection / 'README.md'
                landing.parent.mkdir()
                landing.write_text('Editorial intro.\n<!-- recipes:start -->\n<!-- recipes:end -->\n')
            sentinel = folder / 'sentinel.md'
            sentinel.write_text('unchanged')
            recipe = dict(self.recipes[0], readme='../sentinel.md')
            (root / 'catalog.json').write_text(json.dumps({'schema_version': 1, 'recipes': [recipe]}))
            with patch.object(catalog, 'ROOT', root), patch('sys.argv', ['catalog.py', 'build']):
                with self.assertRaises(ValueError):
                    catalog.main()
            self.assertEqual(sentinel.read_text(), 'unchanged')
            self.assertFalse((root / 'docs').exists())

    def test_symlink_output_rejected_before_any_write(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            root = folder / 'checkout'
            root.mkdir()
            (root / 'README.md').write_text('<!-- cookbook-stats:start --><!-- cookbook-stats:end -->')
            for collection in ['examples', 'integrations', 'playbook', 'use-cases']:
                landing = root / collection / 'README.md'
                landing.parent.mkdir()
                landing.write_text('Editorial intro.\n<!-- recipes:start -->\n<!-- recipes:end -->\n')
            sentinel = folder / 'sentinel.md'
            sentinel.write_text('unchanged')
            recipe = self.recipes[0]
            (root / 'catalog.json').write_text(json.dumps({'schema_version': 1, 'recipes': [recipe]}))
            target = root / recipe['readme']
            target.parent.mkdir(parents=True)
            target.symlink_to(sentinel)
            with patch.object(catalog, 'ROOT', root), patch('sys.argv', ['catalog.py', 'build']):
                with self.assertRaises(ValueError):
                    catalog.main()
            self.assertEqual(sentinel.read_text(), 'unchanged')
            self.assertFalse((root / 'docs/catalog.md').exists())


if __name__ == '__main__':
    unittest.main()
