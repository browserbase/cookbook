import { Client } from '@temporalio/client';
import { pathToFileURL } from 'node:url';
import { searchWithRetry } from './workflows';

async function runDemo() {
  const client = new Client();
  const query = process.argv[2] || 'TypeScript web scraping';

  try {
    const handle = await client.workflow.start(searchWithRetry, {
      args: [query],
      taskQueue: 'browser-automation',
      workflowId: `resilience-test-${Date.now()}`,
    });

    console.log(`Started workflow: ${handle.workflowId}`);
    console.log(`Monitor at: http://localhost:8233/namespaces/default/workflows/${handle.workflowId}`);

    const result = await handle.result();
    console.log(result);
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDemo().catch(console.error);
}
