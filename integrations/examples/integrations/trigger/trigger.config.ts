import { defineConfig } from '@trigger.dev/sdk/v3';
import { aptGet } from '@trigger.dev/build/extensions/core';
import { puppeteer } from '@trigger.dev/build/extensions/puppeteer';

const project = process.env.TRIGGER_PROJECT_REF;
if (!project || !/^proj_[A-Za-z0-9]+$/.test(project)) {
  throw new Error('Set TRIGGER_PROJECT_REF to your own Trigger.dev project reference.');
}

export default defineConfig({
  maxDuration: 300,
  project,
  dirs: ['./src/trigger'],
  logLevel: 'log',
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    extensions: [
      aptGet({ packages: ['mupdf-tools', 'curl'] }),
      puppeteer(),
    ],
  },
});
