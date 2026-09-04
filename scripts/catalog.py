#!/usr/bin/env python3
"""Generate cookbook guides and search the reviewed source catalog."""

import argparse
import json
import posixpath
import re
import sys
import tomllib
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
TOPICS = {
    'getting-started': ('Getting started', 'Create your first cloud browser and choose a browser SDK.'),
    'authentication': ('Authentication and saved sessions', 'Reuse authenticated contexts, handle MFA, and connect login workflows.'),
    'browser-features': ('Browser configuration', 'Configure proxies, CAPTCHA handling, extensions, metadata, and caching.'),
    'downloads-and-documents': ('Files and documents', 'Upload files, retrieve downloads, capture PDFs, and parse documents.'),
    'extraction-and-research': ('Extraction and research', 'Find pages and extract structured information from them.'),
    'forms-and-transactions': ('Forms and transactions', 'Fill forms and prepare application, booking, and payment workflows.'),
    'agents-and-human-handoff': ('Agents and human handoff', 'Build browser agents and pause work for human input.'),
    'integrations-and-orchestration': ('Integrations and orchestration', 'Connect Browserbase to agent frameworks, services, and workflow engines.'),
    'testing-and-observability': ('Testing and observability', 'Test sites and inspect browser behavior, reliability, and performance.'),
    'commerce-and-travel': ('Commerce and travel', 'Compare products, research travel, and inspect booking workflows.'),
    'business-operations': ('Business operations', 'Automate research and operations across business domains.'),
}
ALIASES = {
    'login': ['authentication', 'context', 'mfa'],
    'session': ['context', 'browser'],
    'persistent': ['context', 'authentication'],
    'cookies': ['context', 'authentication'],
    'download': ['downloads', 'files'],
    'upload': ['uploads', 'files'],
    'pdf': ['documents', 'download'],
    'scrape': ['scraping', 'extraction'],
    'human': ['handoff', 'hitl'],
    'agent': ['agents'],
    'proxy': ['proxies'],
    'forms': ['form', 'filling'],
    'test': ['testing', 'qa'],
}

NEGATIVE_LLM_PATTERNS = (
    r'\bno\s+(?:llm|model|ai)\b',
    r'\bwithout\s+(?:an?\s+)?(?:llm|model|ai)\b',
    r'\braw\s+(?:playwright|puppeteer|selenium)\b',
)
LLM_SIGNALS = {'stagehand', 'openai', 'anthropic', 'claude', 'gemini', 'agent', 'agents', 'llm', 'model'}
DIRECT_BROWSER_SIGNALS = {'browserbase', 'playwright', 'puppeteer', 'selenium'}
VERIFICATION_LEVELS = {
    'source-inspected': 'Source inspected',
    'install-verified': 'Clean install verified',
    'typechecked': 'Typechecked',
    'offline-tested': 'Offline behavior tested',
    'live-tested': 'Live workflow tested',
}
ENVIRONMENT_FIELDS = {
    'name', 'requirement', 'provider', 'purpose', 'secret', 'safe_example',
    'validation', 'default', 'setup_url',
}
NODE_BOUNDARIES = {
    'integrations/package.json': ('24.19.0', None),
    'integrations/examples/integrations/mastra/package.json': (
        '24.19.0', 'integrations/examples/integrations/mastra/README.md'),
    'integrations/examples/integrations/vercel/BrowseGPT/package.json': ('24.19.0', None),
    'use-cases/qa-and-observability/browserbase/qa-agent-demo/qa-agent/package.json': ('24.19.0', None),
}


def validate_node_boundaries():
    """Keep concrete package and prerequisite minima aligned with installed contracts."""
    for manifest, (minimum, documentation) in NODE_BOUNDARIES.items():
        path = ROOT / manifest
        if not path.exists():
            continue
        engine = json.loads(path.read_text()).get('engines', {}).get('node', '')
        match = re.search(r'(\d+)\.(\d+)\.(\d+)', engine)
        if not match or tuple(map(int, match.groups())) < tuple(map(int, minimum.split('.'))):
            raise ValueError(f'{manifest} must require Node {minimum} or newer')
        if documentation:
            text = (ROOT / documentation).read_text()
            if not re.search(r'Node(?:\.js)?\s+(?:>=|≥|\^)?' + re.escape(minimum), text, re.I):
                raise ValueError(f'{documentation} must document Node {minimum}')


def catalog():
    data = json.loads((ROOT / 'catalog.json').read_text())
    if data.get('schema_version') != 1:
        raise ValueError('Unsupported catalog schema_version')
    recipes = data['recipes']
    if len({r['id'] for r in recipes}) != len(recipes):
        raise ValueError('Duplicate recipe IDs')
    for recipe in recipes:
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', recipe['id']):
            raise ValueError('Unsafe recipe ID')
        if recipe['readme'] != 'docs/recipes/' + recipe['id'] + '.md':
            raise ValueError('Recipe guide must match its canonical output path')
        if not recipe['topics'] or any(topic not in TOPICS for topic in recipe['topics']):
            raise ValueError('Unknown or missing topic for ' + recipe['id'])
        verification = recipe.get('verification')
        if verification not in VERIFICATION_LEVELS:
            raise ValueError('Unknown verification level for ' + recipe['id'])
        evidence = recipe.get('verification_evidence', [])
        if not isinstance(evidence, list):
            raise ValueError('Verification evidence must be a list for ' + recipe['id'])
        for item in evidence:
            if not isinstance(item, dict) or set(item) != {'kind', 'date', 'runtime', 'command', 'result', 'limits'}:
                raise ValueError('Invalid verification evidence fields for ' + recipe['id'])
            if item['kind'] not in set(VERIFICATION_LEVELS) - {'source-inspected'}:
                raise ValueError('Invalid verification evidence kind for ' + recipe['id'])
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', item['date']):
                raise ValueError('Invalid verification evidence date for ' + recipe['id'])
            if item['result'] not in {'passed', 'failed'}:
                raise ValueError('Invalid verification evidence result for ' + recipe['id'])
            if any(not isinstance(item[field], str) or not item[field].strip()
                   for field in ('runtime', 'command', 'limits')):
                raise ValueError('Incomplete verification evidence for ' + recipe['id'])
        if verification != 'source-inspected' and not any(
                item['kind'] == verification and item['result'] == 'passed' for item in evidence):
            raise ValueError('Verification level lacks passing evidence for ' + recipe['id'])
        environment = recipe.get('environment_variables', [])
        if not isinstance(environment, list):
            raise ValueError('Environment metadata must be a list for ' + recipe['id'])
        names = set()
        for item in environment:
            if not isinstance(item, dict) or set(item) != ENVIRONMENT_FIELDS:
                raise ValueError('Invalid environment metadata fields for ' + recipe['id'])
            if not re.fullmatch(r'[A-Z][A-Z0-9_]*', item['name']) or item['name'] in names:
                raise ValueError('Invalid or duplicate environment variable for ' + recipe['id'])
            names.add(item['name'])
            if item['requirement'] not in {'required', 'optional', 'conditional'}:
                raise ValueError('Invalid environment requirement for ' + recipe['id'])
            if not isinstance(item['secret'], bool):
                raise ValueError('Environment secret flag must be boolean for ' + recipe['id'])
            if any(not isinstance(item[field], str) or not item[field].strip()
                   for field in ('provider', 'purpose', 'safe_example', 'validation')):
                raise ValueError('Incomplete environment metadata for ' + recipe['id'])
            if item['default'] is not None and not isinstance(item['default'], str):
                raise ValueError('Environment default must be a string or null for ' + recipe['id'])
            if item['setup_url'] is not None and not re.fullmatch(r'https://[^\s]+', item['setup_url']):
                raise ValueError('Environment setup URL must be HTTPS for ' + recipe['id'])
    validate_node_boundaries()
    return recipes


def link(target, current):
    return quote(posixpath.relpath(target, posixpath.dirname(current)), safe='/.-_')


def permalink(recipe):
    source = recipe['source']
    return source['repository'] + '/tree/' + source['commit'] + '/' + quote(source['path'], safe='/')


def clean(value):
    return str(value).replace('|', '\\|').replace('\n', ' ')


def ranked(recipes):
    return sorted(recipes, key=lambda r: (r['access'] != 'public', r['lifecycle'] != 'current', r['collection'] != 'examples', r['id']))


def recipe_type(recipe):
    if recipe.get('run_commands'):
        return 'runnable example'
    if recipe.get('collection') == 'integrations':
        return 'integration package'
    if recipe.get('entrypoints'):
        return 'reusable snippet'
    return 'reference'


def llm_requirement(recipe):
    material = tokens(' '.join([
        recipe.get('id', ''), recipe.get('title', ''), recipe.get('summary', ''),
        *recipe.get('frameworks', []),
        *[item['name'] for item in recipe.get('environment_variables', [])],
    ]))
    if material & LLM_SIGNALS:
        return 'required'
    if material & DIRECT_BROWSER_SIGNALS:
        return 'not required'
    return 'unknown'


def table(recipes, current):
    lines = ['| Recipe | Language | Type | Status | Collection |', '| --- | --- | --- | --- | --- |']
    for r in ranked(recipes):
        lines.append('| [' + clean(r['title']) + '](' + link(r['readme'], current) + ') | ' + ', '.join(r['languages']) + ' | ' + recipe_type(r) + ' | ' + r['lifecycle'] + ' / ' + r['access'] + ' | ' + r['collection'] + ' |')
    return '\n'.join(lines)


def guide(r):
    current = r['readme']
    lines = ['# ' + r['title'], '', r['summary'], '', '**Status:** ' + r['lifecycle'] + ' · ' + r['access'] + ' · ' + VERIFICATION_LEVELS[r['verification']].lower() + '.', '', '**Recipe type:** ' + recipe_type(r) + '.', '**LLM requirement:** ' + llm_requirement(r) + ' (derived from the inspected framework and configuration metadata).', '', '## Code and prerequisites', '', '- Working directory from the cookbook root: `' + r['working_directory'] + '`.', '- Languages: ' + (', '.join(r['languages']) or 'See source') + '.', '- Frameworks: ' + (', '.join(r['frameworks']) or 'See dependency manifest') + '.']
    if r.get('upstream_readme'):
        lines.append('- [Upstream setup and behavior](' + link(r['upstream_readme'], current) + ').')
    for manifest in r.get('manifests', []):
        lines.append('- [Dependency manifest `' + manifest + '`](' + link(manifest, current) + ').')
    for entry in r['entrypoints']:
        lines.append('- [Source `' + entry + '`](' + link(entry, current) + ').')
    if r.get('tags'):
        lines.append('- Original use-case taxonomy: ' + ', '.join(r['tags']) + '.')
    lines += ['', '## Setup and run', '', 'Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.']
    if r['setup_commands'] or r['run_commands']:
        lines += ['', '```sh', 'cd ' + r['working_directory'], *r['setup_commands'], *([r['environment_setup_command']] if r.get('environment_setup_command') else []), '```']
    else:
        lines += ['', 'This source has no established standalone launch command. Read its upstream guide and integrate its exports or configure its application first.']
    if r['run_commands']:
        lines += ['', 'Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.', '', '```sh', *r['run_commands'], '```']
    elif r['entrypoints']:
        lines += ['', 'No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.']
    lines += ['', '## Environment', '']
    if r.get('environment_template'):
        lines += ['[Environment template](' + link(r['environment_template'], current) + ') lists example configuration. Fill in your own values locally.', '']
    if r['environment_variables']:
        for requirement, heading in [('required', 'Required'), ('conditional', 'Conditional'), ('optional', 'Optional')]:
            items = [item for item in r['environment_variables'] if item['requirement'] == requirement]
            if not items:
                continue
            lines += ['### ' + heading, '', '| Variable | Provider and purpose | Safe example | Validation and default |',
                      '| --- | --- | --- | --- |']
            for item in items:
                provider = clean(item['provider'])
                if item['setup_url']:
                    provider = '[' + provider + '](' + item['setup_url'] + ')'
                purpose = clean(item['purpose']) + (' Secret.' if item['secret'] else ' Non-secret.')
                default = 'No default' if item['default'] is None else 'Default: `' + clean(item['default']) + '`'
                lines.append('| `' + item['name'] + '` | ' + provider + '. ' + purpose + ' | `' + clean(item['safe_example']) + '` | ' + clean(item['validation']) + '. ' + default + '. |')
            lines += ['']
    else:
        lines += ['No direct environment variable references were extracted. SDK defaults, external configuration, and deployment settings may still require credentials. Read the source before running.']
    lines += ['', '## Dependencies', '']
    primary = primary_dependency_manifest(r)
    if primary:
        lines += ['Declared runtime dependencies from [' + primary + '](' + link(primary, current) + '). Alternate manifests may differ; use the documented setup path.', '']
    deps = r['dependencies']
    if isinstance(deps, dict) and deps:
        lines += ['| Package | Declared version |', '| --- | --- |', *['| `' + clean(k) + '` | `' + clean(v) + '` |' for k, v in sorted(deps.items())]]
    elif deps:
        lines += ['Declared source dependencies.', '', *['- `' + clean(d) + '`' for d in deps]]
    else:
        lines += ['Consult the linked manifest or upstream instructions. This catalog does not invent missing dependency versions.']
    for manifest in r.get('manifests', []):
        if manifest == primary or Path(manifest).name not in ('package.json', 'pyproject.toml', 'requirements.txt', 'go.mod'):
            continue
        secondary = declared_dependencies(dict(r, manifests=[manifest], primary_manifest=manifest))
        lines += ['', '### Additional manifest: `' + manifest + '`', '',
                  '[Manifest](' + link(manifest, current) + '). Follow the documented setup path; these declarations are not merged with the primary manifest.', '']
        if isinstance(secondary, dict):
            lines += ['| Package | Declared version |', '| --- | --- |',
                      *['| `' + clean(k) + '` | `' + clean(v) + '` |' for k, v in sorted(secondary.items())]]
        else:
            lines += ['- `' + clean(d) + '`' for d in secondary]
    lines += ['', '## Caveats and verification', '', 'Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.']
    evidence = r.get('verification_evidence', [])
    if evidence:
        lines += ['', '| Check | Date | Runtime | Command | Result and limits |',
                  '| --- | --- | --- | --- | --- |']
        for item in evidence:
            lines.append('| ' + VERIFICATION_LEVELS[item['kind']] + ' | ' + item['date'] + ' | `' + clean(item['runtime']) + '` | `' + clean(item['command']) + '` | ' + item['result'] + '. ' + clean(item['limits']) + ' |')
    if r['caveats']:
        lines += ['', *['- ' + c for c in r['caveats']]]
    if r['access'] == 'private':
        lines += ['', 'This recipe came from a private repository. Keep its source and derived artifacts access-controlled.']
    lines += ['', '## Provenance', '', '[Pinned upstream source](' + permalink(r) + ') at commit `' + r['source']['commit'] + '`.', '', 'Related topics: ' + ', '.join('[' + TOPICS[t][0] + '](' + link('docs/topics/' + t + '.md', current) + ')' for t in r['topics']) + '.', '']
    return '\n'.join(lines)


def generated(recipes):
    out = {r['readme']: guide(r) for r in recipes}
    counts = [(len(recipes), 'RECIPES'), (len(TOPICS), 'TOPICS'),
              (len({v for r in recipes for v in r['languages']}), 'LANGUAGES'),
              (len({r['collection'] for r in recipes}), 'COLLECTIONS')]
    stats_text = 'Cookbook catalog: ' + ', '.join(f'{n} {label.lower()}' for n, label in counts)
    readme = (ROOT / 'README.md').read_text()
    start, end = '<!-- cookbook-stats:start -->', '<!-- cookbook-stats:end -->'
    marker_counts = (readme.count(start), readme.count(end))
    if marker_counts not in {(0, 0), (1, 1)} or (marker_counts == (1, 1) and readme.index(start) > readme.index(end)):
        raise ValueError('Missing or invalid cookbook stats markers: README.md')
    out['README.md'] = readme
    if marker_counts == (1, 1):
        before, remainder = readme.split(start)
        _, after = remainder.split(end)
        out['README.md'] = (before + start + '\n<p align="center">\n'
                            + f'  <img src="assets/cookbook-stats.svg" alt="{stats_text}" width="880" />\n'
                            + '</p>\n' + end + after)
        cells = ''.join(
            f'<text x="{110 + i * 220}" y="69" class="value">{count}</text>'
            f'<text x="{110 + i * 220}" y="100" class="label">{label}</text>'
            for i, (count, label) in enumerate(counts))
        out['assets/cookbook-stats.svg'] = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="880" height="136" viewBox="0 0 880 136" role="img" aria-labelledby="title">'
            '<title id="title">' + stats_text + '</title>'
            '<style>.value{font:600 40px ui-monospace,monospace;fill:#FF4500;text-anchor:middle}'
            '.label{font:12px ui-monospace,monospace;letter-spacing:2px;fill:#525252;text-anchor:middle}</style>'
            '<rect x=".5" y=".5" width="879" height="135" rx="12" fill="#FAFAF9" stroke="#E7E5E4"/>'
            + cells + '</svg>\n')
    main = ['# Recipe catalog', '', 'Browse by task. Current public examples appear first. Playbook patterns and private applications retain their original execution boundaries. Inspect each recipe manifest and verification record for compatibility.', '', 'Every entry is source-inspected. This is not a claim that every imported project has been installed or run.', '', 'Search locally with `python3 scripts/catalog.py search "persistent login" --language python --limit 5`. Add `--json` for structured output.', '']
    for topic, (title, purpose) in TOPICS.items():
        members = [r for r in recipes if topic in r['topics']]
        path = 'docs/topics/' + topic + '.md'
        main += ['- [' + title + '](topics/' + topic + '.md) (' + str(len(members)) + '). ' + purpose]
        out[path] = '\n'.join(['# ' + title, '', purpose, '', 'Open a recipe guide for its working directory, commands, environment references, dependency versions, and source provenance.', '', table(members, path), '', '[All topics](../catalog.md)', ''])
        reference = 'skills/browserbase-cookbook/references/' + topic + '.md'
        picks = ranked(members)
        out[reference] = '\n'.join(['# ' + title, '', purpose, '', 'Paths below are relative to a local cookbook root, not to the installed skill directory. Locate the checkout first. Read the selected guide and source before adapting code. Historical provenance links identify the imported revision; they predate cookbook migrations and are not runnable fallbacks. Private sources require access.', '', 'This topic contains all ' + str(len(members)) + ' matching entries. Browse `docs/topics/' + topic + '.md` or run `python3 scripts/catalog.py search "<task>" --language python --limit 5` from the cookbook root for other languages or frameworks.', '', '| Recipe | Language | Local guide | Status | Historical provenance |', '| --- | --- | --- | --- | --- |', *['| ' + clean(r['title']) + ' | ' + ', '.join(r['languages']) + ' | `' + r['readme'] + '` | ' + r['lifecycle'] + '/' + r['access'] + ' | [pinned import](' + permalink(r) + ') |' for r in picks], ''])
    main += ['', '## All recipes', '', table(recipes, 'docs/catalog.md'), '']
    out['docs/catalog.md'] = '\n'.join(main)
    for collection in ['examples', 'integrations', 'playbook', 'use-cases']:
        name = collection + '/README.md'
        path = ROOT / name
        if not path.is_file():
            raise ValueError('Missing collection landing page: ' + name)
        existing = path.read_text()
        start = '<!-- recipes:start -->'
        end = '<!-- recipes:end -->'
        if existing.count(start) != 1 or existing.count(end) != 1 or existing.index(start) > existing.index(end):
            raise ValueError('Missing or invalid recipe table markers: ' + name)
        before, remainder = existing.split(start)
        _, after = remainder.split(end)
        members = [recipe for recipe in recipes if recipe['collection'] == collection]
        out[name] = before + start + '\n\n' + table(members, name) + '\n\n' + end + after
    return out


def tokens(text):
    return set(re.findall(r'[a-z0-9]+', text.lower()))


def search(recipes, query, language, limit, access='public', lifecycle=None, kind=None):
    without_llm = any(re.search(pattern, query, re.I) for pattern in NEGATIVE_LLM_PATTERNS)
    normalized_query = query
    for pattern in NEGATIVE_LLM_PATTERNS[:2]:
        normalized_query = re.sub(pattern, ' ', normalized_query, flags=re.I)
    query_tokens = tokens(normalized_query)
    ignored = {'a', 'an', 'the', 'to', 'for', 'with', 'in', 'i', 'want', 'need', 'example', 'how', 'do', 'and', 'of', 'using', 'raw'}
    query_tokens -= ignored
    if without_llm and not query_tokens:
        query_tokens = {'browser'}
    if not query_tokens:
        return []
    results = []
    for recipe in recipes:
        if language and language.lower() not in recipe['languages']:
            continue
        if access and access != 'any' and recipe['access'] != access:
            continue
        if lifecycle and lifecycle != 'any' and recipe['lifecycle'] != lifecycle:
            continue
        if kind and kind != 'any' and recipe_type(recipe) != kind:
            continue
        if without_llm and llm_requirement(recipe) != 'not required':
            continue
        primary = tokens(' '.join([recipe['id'], recipe['title'], *recipe['frameworks'], *recipe['languages']]))
        topic_tokens = tokens(' '.join(recipe['topics']))
        secondary = tokens(recipe['summary'] + ' ' + ' '.join(recipe.get('tags', [])))
        score = 0
        matched = 0
        for token in query_tokens:
            alternatives = set(ALIASES.get(token, []))
            if token in primary:
                score += 12
                matched += 1
            elif token in secondary:
                score += 6
                matched += 1
            elif token in topic_tokens:
                score += 2
                matched += 1
            elif alternatives & (primary | secondary | topic_tokens):
                score += 3
                matched += 1
        # A result must satisfy every meaningful positive term. Adjacent partial
        # matches are more dangerous than no result for auth, limits, uploads,
        # and other side-effecting capabilities.
        if matched == len(query_tokens):
            results.append((matched, score, recipe))
    results.sort(key=lambda item: (-item[0], item[2]['access'] != 'public', -item[1], item[2]['collection'] != 'examples', item[2]['id']))
    return [dict(recipe, search_score=score, matched_terms=matched) for matched, score, recipe in results[:limit]]


def validate_outputs(output, obsolete):
    root = ROOT.resolve()
    for name in [*output, *(str(path.relative_to(ROOT)) for path in obsolete)]:
        path = ROOT / name
        if path.is_symlink():
            raise ValueError('Refusing symlink output: ' + name)
        try:
            path.resolve().relative_to(root)
        except ValueError as error:
            raise ValueError('Output escapes cookbook root: ' + name) from error
        for parent in path.parents:
            if parent == ROOT:
                break
            if parent.is_symlink():
                raise ValueError('Refusing symlink output directory: ' + name)


def primary_dependency_manifest(recipe):
    if 'primary_manifest' in recipe:
        primary = recipe['primary_manifest']
        if not isinstance(primary, str) or primary not in recipe.get('manifests', []):
            raise ValueError('Primary manifest must be a recorded manifest: ' + recipe['id'])
        if Path(primary).name not in ('package.json', 'pyproject.toml', 'requirements.txt', 'go.mod'):
            raise ValueError('Unsupported primary manifest: ' + recipe['id'])
        return primary
    for filename in ('package.json', 'pyproject.toml', 'requirements.txt', 'go.mod'):
        matches = [name for name in recipe.get('manifests', []) if Path(name).name == filename]
        if len(matches) > 1:
            raise ValueError('Multiple dependency manifests need explicit scope: ' + recipe['id'])
        if matches:
            return matches[0]
    return None


def go_dependencies(source):
    declared = {}
    in_require = False
    for raw in source.splitlines():
        line, _, comment = raw.partition('//')
        line = line.strip()
        if not line:
            continue
        if line.startswith(('replace ', 'exclude ')):
            raise ValueError('Go replacements/exclusions require explicit metadata')
        if line == 'require (':
            in_require = True
            continue
        if in_require and line == ')':
            in_require = False
            continue
        if line.startswith('require ') or in_require:
            requirement = line.removeprefix('require ')
            parts = requirement.split()
            if len(parts) != 2 or not parts[1].startswith('v'):
                raise ValueError('Unsupported Go require declaration')
            if comment.strip() != 'indirect':
                declared[parts[0]] = parts[1]
    if in_require:
        raise ValueError('Unclosed Go require block')
    return declared


def declared_dependencies(recipe):
    name = primary_dependency_manifest(recipe)
    if name is None:
        return None
    path = (ROOT / name).resolve()
    if not path.is_relative_to(ROOT.resolve()):
        raise ValueError('Dependency manifest escapes cookbook: ' + recipe['id'])
    if path.name == 'go.mod':
        declared = go_dependencies(path.read_text())
    elif path.name == 'package.json':
        declared = json.loads(path.read_text()).get('dependencies', {})
    elif path.name == 'pyproject.toml':
        data = tomllib.loads(path.read_text())
        if 'project' in data:
            project = data['project']
            if 'dependencies' in project.get('dynamic', []):
                raise ValueError('Dynamic dependencies require explicit metadata: ' + recipe['id'])
            declared = project.get('dependencies', [])
        else:
            declared = dict(data.get('tool', {}).get('poetry', {}).get('dependencies', {}))
            declared.pop('python', None)
    else:
        declared = []
        for line in path.read_text().splitlines():
            line = re.split(r'\s+#', line, maxsplit=1)[0].strip()
            if not line or line.startswith('#'):
                continue
            if line.startswith('-') or line.endswith('\\'):
                raise ValueError('Requirements options/includes need explicit metadata: ' + recipe['id'])
            declared.append(line)
    if isinstance(declared, dict):
        valid = all(isinstance(k, str) and isinstance(v, str) for k, v in declared.items())
    elif isinstance(declared, list):
        valid = all(isinstance(v, str) and v.strip() for v in declared)
        declared = sorted(set(declared))
    else:
        valid = False
    if not valid:
        raise ValueError('Invalid dependency declaration: ' + recipe['id'])
    return declared


def dependency_drift(recipes):
    updates = {}
    for recipe in recipes:
        if recipe.get('working_directory'):
            directory = (ROOT / recipe['working_directory']).resolve()
            if not directory.is_relative_to(ROOT.resolve()):
                raise ValueError('Working directory escapes cookbook: ' + recipe['id'])
            recorded = {(ROOT / name).resolve() for name in recipe.get('manifests', [])}
            missing = [name for name in ('package.json', 'pyproject.toml', 'requirements.txt', 'go.mod')
                       if (directory / name).is_file() and (directory / name).resolve() not in recorded]
            if missing:
                raise ValueError('Unrecorded working-directory manifests for ' + recipe['id'] + ': ' + ', '.join(missing))
        declared = declared_dependencies(recipe)
        if recipe.get('matching_dependency_manifests'):
            for manifest in recipe['manifests']:
                alternate = declared_dependencies(dict(recipe, manifests=[manifest], primary_manifest=manifest))
                if alternate != declared:
                    raise ValueError('Dependency mirrors disagree: ' + recipe['id'] + ': ' + manifest)
        if declared is not None and recipe.get('dependencies') != declared:
            updates[recipe['id']] = declared
    return updates


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('build', help='Regenerate reviewed recipe guides and topic indexes')
    sub.add_parser('check', help='Detect dependency and generated-document drift without mutation')
    sub.add_parser('refresh-dependencies', help='Refresh declared dependencies from recorded primary manifests')
    find = sub.add_parser('search', help='Deterministic token search, including playbook and private entries')
    find.add_argument('query')
    find.add_argument('--language', choices=['python', 'typescript', 'javascript', 'go'])
    find.add_argument('--limit', type=int, default=5)
    find.add_argument('--access', choices=['public', 'private', 'any'], default='public', help='Visibility boundary (default: public)')
    find.add_argument('--lifecycle', choices=['current', 'legacy', 'any'])
    find.add_argument('--type', dest='kind', choices=['runnable example', 'integration package', 'reusable snippet', 'reference', 'any'])
    find.add_argument('--json', action='store_true')
    args = parser.parse_args()
    recipes = catalog()
    if args.command in {'check', 'refresh-dependencies'}:
        updates = dependency_drift(recipes)
        if args.command == 'refresh-dependencies':
            data = json.loads((ROOT / 'catalog.json').read_text())
            for recipe in data['recipes']:
                if recipe['id'] in updates:
                    recipe['dependencies'] = updates[recipe['id']]
            (ROOT / 'catalog.json').write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
            print(f'Refreshed {len(updates)} dependency records. Run catalog.py build.')
            return 0
        if updates:
            print('Declared dependency drift:\n' + '\n'.join(updates), file=sys.stderr)
            return 1
    if args.command == 'search':
        if args.limit < 1:
            parser.error('--limit must be positive')
        matches = search(recipes, args.query, args.language, args.limit, args.access, args.lifecycle, args.kind)
        if args.json:
            print(json.dumps(matches, indent=2))
        elif not matches:
            print('No recipe satisfies every requested constraint. Try a supported capability or broaden an explicit filter.')
        else:
            for recipe in matches:
                print(recipe['title'] + ' [' + recipe['lifecycle'] + '/' + recipe['access'] + ']')
                print('  ' + recipe['readme'])
                print('  ' + recipe['summary'])
        return 0
    output = generated(recipes)
    owned = ['docs/recipes', 'docs/topics', 'skills/browserbase-cookbook/references']
    obsolete = [path for folder in owned for path in (ROOT / folder).glob('*.md') if str(path.relative_to(ROOT)) not in output]
    validate_outputs(output, obsolete)
    drift = []
    for name, content in output.items():
        path = ROOT / name
        if args.command == 'build':
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        elif not path.exists() or path.read_text() != content:
            drift.append(name)
    if args.command == 'build':
        for path in obsolete:
            path.unlink()
        print('Built ' + str(len(output)) + ' documents for ' + str(len(recipes)) + ' recipes.')
    else:
        drift.extend(str(path.relative_to(ROOT)) for path in obsolete)
        if drift:
            print('Generated document drift:\n' + '\n'.join(drift), file=sys.stderr)
            return 1
        print('Catalog documents are current (' + str(len(recipes)) + ' recipes).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
