import type { Agent, AgentExecutionOptionsBase } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { bindBrowserOwner } from '../tools/browser-owner.ts';

const installed = new WeakSet<Agent>();

type Options = AgentExecutionOptionsBase<unknown>;

async function invokeWithBrowserOwner(
  invoke: (options: Options) => unknown,
  options: Options,
  streaming: boolean,
) {
  const requestContext = new RequestContext(options.requestContext?.entries());
  const owner = bindBrowserOwner(requestContext);
  const onFinish: NonNullable<Options['onFinish']> = async (...args) => {
    try {
      await options.onFinish?.(...args);
    } finally {
      await owner.close();
    }
  };
  const onError: NonNullable<Options['onError']> = async (...args) => {
    try {
      await options.onError?.(...args);
    } finally {
      await owner.close();
    }
  };
  const onAbort: NonNullable<Options['onAbort']> = async (...args) => {
    try {
      await options.onAbort?.(...args);
    } finally {
      await owner.close();
    }
  };
  try {
    return await invoke({ ...options, requestContext, onFinish, onError, onAbort });
  } catch (error) {
    try {
      await owner.close();
    } catch (cleanupError) {
      console.error('Browser cleanup failed', cleanupError);
    }
    throw error;
  } finally {
    if (!streaming) await owner.close();
  }
}

export function installBrowserLifecycle<T extends Agent>(agent: T): T {
  if (installed.has(agent)) return agent;
  agent.generate = new Proxy(agent.generate, {
    apply(target, receiver, args) {
      return invokeWithBrowserOwner(
        options => Reflect.apply(target, receiver, [args[0], options]),
        args[1] ?? {},
        false,
      );
    },
  });
  agent.stream = new Proxy(agent.stream, {
    apply(target, receiver, args) {
      return invokeWithBrowserOwner(
        options => Reflect.apply(target, receiver, [args[0], options]),
        args[1] ?? {},
        true,
      );
    },
  });
  installed.add(agent);
  return agent;
}
