import { lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from 'ai';

export function shouldResumeAfterConfirmation({ messages }: { messages: UIMessage[] }): boolean {
  const last = messages.at(-1);
  if (!last || !lastAssistantMessageIsCompleteWithToolCalls({ messages })) return false;
  const stepStart = last.parts.findLastIndex(part => part.type === 'step-start');
  return last.parts.slice(stepStart + 1).some(part =>
    part.type === 'tool-askForConfirmation' && part.state === 'output-available',
  );
}
