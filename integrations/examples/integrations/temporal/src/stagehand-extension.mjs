import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function stagehandExtensionPath() {
  const entrypoint = fileURLToPath(import.meta.resolve('@browserbasehq/stagehand'));
  return join(dirname(entrypoint), 'assets', 'stagehand-extension.zip');
}
