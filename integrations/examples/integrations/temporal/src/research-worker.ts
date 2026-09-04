import { Worker } from '@temporalio/worker';
import { createRequire } from 'node:module';
import * as activities from './research-activities';

const require = createRequire(import.meta.url);

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: 'browser-automation',
    maxConcurrentActivityTaskExecutions: 2,
    shutdownGraceTime: '2 minutes',
    shutdownForceTime: '3 minutes',
  });

  await worker.run();
}

run().catch(() => {
  console.error('Research worker failed.');
  process.exitCode = 1;
});
