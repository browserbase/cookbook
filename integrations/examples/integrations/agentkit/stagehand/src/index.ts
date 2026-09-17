import { browserbase } from '@browserbasehq/stagehand';
/* eslint-disable */
import 'dotenv/config';

import { createServer } from '@inngest/agent-kit/server';
import { Inngest } from 'inngest';
import {
  createAgent,
  createNetwork,
  createRoutingAgent,
  createTool,
  openai,
  State,
} from '@inngest/agent-kit';
import { z } from 'zod';
import Browserbase from '@browserbasehq/sdk';

import { isLastMessageOfType, lastResult } from './utils.js';
import { navigate, extract, act, observe } from './stagehand-tools.js';

const bb = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY as string,
});

const webSearchAgent = createAgent({
  name: 'web_search_agent',
  description: 'I am a web search agent.',
  system: `You are a web search agent.
  `,
  tools: [navigate, extract, act, observe],
});

const supervisorRoutingAgent = createRoutingAgent({
  name: 'Supervisor',
  description: 'I am a Research supervisor.',
  system: `You are a research supervisor.
Your goal is to search for information linked to the user request by augmenting your own research with the "web_search_agent" agent.

Think step by step and reason through your decision.

When the answer is found, call the "done" agent.`,
  model: openai({
    model: 'gpt-4o',
  }),
  tools: [
    createTool({
      name: 'route_to_agent',
      description: 'Invoke an agent to perform a task',
      parameters: z.object({
        agent: z.string().describe('The agent to invoke'),
      }),
      handler: async ({ agent }) => {
        return agent;
      },
    }),
  ],
  tool_choice: 'route_to_agent',
  lifecycle: {
    onRoute: ({ result, network }) => {
      const lastMessage = lastResult(network?.state.results);

      // ensure to loop back to the last executing agent if a tool has been called
      if (lastMessage && isLastMessageOfType(lastMessage, 'tool_call')) {
        return [lastMessage.agentName];
      }

      const tool = result.toolCalls[0];
      if (!tool) {
        return;
      }
      const toolName = tool.tool.name;
      if (toolName === 'done') {
        return;
      } else if (toolName === 'route_to_agent') {
        if (
          typeof tool.content === 'object' &&
          tool.content !== null &&
          'data' in tool.content &&
          typeof tool.content.data === 'string'
        ) {
          return [tool.content.data];
        }
      }
      return;
    },
  },
});

// Create a network with the agents and default router
const searchNetwork = createNetwork({
  name: 'Simple Search Network',
  agents: [webSearchAgent],
  maxIter: 15,
  defaultModel: openai({
    model: 'gpt-4o',
  }),
  defaultRouter: supervisorRoutingAgent,
});

const inngest = new Inngest({
  id: 'Simple Search Agent',
});

const simpleSearchWorkflow = inngest.createFunction(
  {
    id: 'simple-search-agent-workflow',
    triggers: [{ event: 'app/support.ticket.created' }],
  },
  async ({ step, event }) => {
    const browserbaseSessionID = await step.run(
      'create_browserbase_session',
      async () => {
        const browser = await browserbase.launch({
          apiKey: process.env.BROWSERBASE_API_KEY!,
          keepAlive: true,
        });
        const sessionId = browser.sessionId;
        try {
          await browser.close();
        } catch (error) {
          if (sessionId) {
            try {
              await bb.sessions.update(sessionId, {
                status: 'REQUEST_RELEASE',
              });
            } catch (releaseError) {
              throw new AggregateError([error, releaseError], 'Initial disconnect and session release failed.');
            }
          }
          throw error;
        }
        if (!sessionId)
          throw new Error('Browserbase did not return a session ID');
        return sessionId;
      }
    );

    let response;
    const errors: unknown[] = [];
    try {
      response = await searchNetwork.run(event.data.input, {
        state: new State({ data: { browserbaseSessionID } }),
      });
    } catch (error) {
      errors.push(error);
    } finally {
      try {
        await step.run('close-browserbase-session', async () => {
          await bb.sessions.update(browserbaseSessionID, {
            status: 'REQUEST_RELEASE',
          });
        });
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Search and session release failed.');
    return { response };
  }
);

// Create and start the server
const server = createServer({
  functions: [simpleSearchWorkflow as any],
});

server.listen(3010, () =>
  console.log('Simple search Agent demo server is running on port 3010')
);
