'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useState, useEffect, useRef } from 'react';
import { shouldResumeAfterConfirmation } from '@/lib/confirmation';
import { Confirmation } from '@/components/confirmation';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Markdown from 'react-markdown';
import { MarkdownWrapper } from '@/components/ui/markdown';
import remarkGfm from 'remark-gfm';
import BlurFade from "@/components/ui/blur-fade";
import VercelLogo from "@/components/vercel";
import BrowserbaseLogo from "@/components/browserbase"
import FlickeringGrid from '@/components/ui/flickering-grid';
import FlickeringLoad from '@/components/ui/flickering-load';
import { Prompts } from '@/components/prompts';

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

function isToolUIPart(p: UIMessage['parts'][number]): boolean {
  return typeof p.type === 'string' && (p.type.startsWith('tool-') || p.type === 'dynamic-tool');
}

type ToolPartLoose = {
  type: string;
  state?: string;
  toolCallId?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
};

export default function Chat() {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSubmittedRef = useRef('');
  const pendingInputRef = useRef<string | null>(null);
  const sawRequestRef = useRef(false);
  const sessionRef = useRef<{ capability: string; debuggerUrl: string; expiresAt: number } | null>(null);
  const [browserSession, setBrowserSession] = useState<typeof sessionRef.current>(null);
  const busyRef = useRef(false);
  const endingRef = useRef(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [canClearSession, setCanClearSession] = useState(false);
  const [transport] = useState(() => new DefaultChatTransport({
    api: '/api/chat',
    headers: () => ({
      'x-browsegpt-client': '1',
      'x-browsegpt-session': sessionRef.current?.capability ?? '',
    }),
  }));
  const { messages, sendMessage, status, error, clearError, addToolOutput, stop, setMessages } = useChat({
    transport,
    sendAutomaticallyWhen: shouldResumeAfterConfirmation,
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    if (status === 'submitted' || status === 'streaming') sawRequestRef.current = true;
    if (error || status === 'error') {
      const lastUser = [...messages].reverse().find(message => message.role === 'user');
      const draft = lastSubmittedRef.current || (lastUser ? messageText(lastUser) : '');
      setInput(current => current || draft);
      pendingInputRef.current = null;
      sawRequestRef.current = false;
    } else if (status === 'ready' && sawRequestRef.current) {
      const submitted = pendingInputRef.current;
      if (submitted !== null) setInput(current => current === submitted ? '' : current);
      pendingInputRef.current = null;
      sawRequestRef.current = false;
    }
  }, [error, status, messages]);

  const editAndResubmit = () => {
    if (isLoading || sessionBusy || busyRef.current) return;
    const lastUser = [...messages].reverse().find(message => message.role === 'user');
    setInput(lastSubmittedRef.current || (lastUser ? messageText(lastUser) : ''));
    clearError();
    inputRef.current?.focus();
  };


  const [showAlert, setShowAlert] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);

  const lastMessage = messages[messages.length - 1];
  const lastText = lastMessage ? messageText(lastMessage) : '';

  const isGenerating =
    isLoading &&
    (!messages.length ||
      lastMessage?.role !== 'assistant' ||
      !lastText);

  useEffect(() => {
    if (isGenerating) {
      setShowAlert(true);

      const dataCollected = lastMessage?.parts.some((part) => {
        if (!isToolUIPart(part)) return false;
        const tp = part as ToolPartLoose;
        const out = tp.state === 'output-available' ? tp.output : undefined;
        return (
          out &&
          typeof out === 'object' &&
          'dataCollected' in out &&
          (out as { dataCollected?: boolean }).dataCollected === true
        );
      });

      if (dataCollected && !lastText) {
        setStatusMessage('The AI has collected data and is generating a response. Please wait.');
      } else {
        setStatusMessage('The AI is currently processing your request. Please wait.');
      }


    } else {
      setShowAlert(false);
    }
  }, [isGenerating, messages, lastMessage, lastText]);

  const submitText = async (text: string) => {
    if (!text.trim() || busyRef.current || isLoading) return;
    busyRef.current = true;
    setSessionBusy(true);
    setSessionError('');
    clearError();
    lastSubmittedRef.current = text;
    pendingInputRef.current = text;
    setInput(text);
    try {
      if (!sessionRef.current) {
        const response = await fetch('/api/session', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-browsegpt-client': '1' }, body: '{}',
        });
        if (!response.ok) throw new Error('Could not start browser session. Please try again.');
        const session = await response.json();
        if (typeof session.capability !== 'string' || typeof session.debuggerUrl !== 'string' ||
            !session.debuggerUrl.startsWith('https://') || !Number.isSafeInteger(session.expiresAt)) {
          throw new Error('Invalid browser session response. Please try again.');
        }
        sessionRef.current = session;
        setBrowserSession(session);
      }
      if (sessionRef.current!.expiresAt * 1000 <= Date.now()) {
        throw new Error('This browser session has expired. End it before starting a new conversation.');
      }
      setHasInteracted(true);
      await sendMessage({ text });
    } catch {
      pendingInputRef.current = null;
      setInput(current => current || text);
      setSessionError('Unable to send your request. Check the browser session and try again.');
    } finally {
      if (!endingRef.current) {
        busyRef.current = false;
        setSessionBusy(false);
      }
    }
  };

  const clearConversation = () => {
    sessionRef.current = null;
    setBrowserSession(null);
    setMessages([]);
    clearError();
    lastSubmittedRef.current = '';
    pendingInputRef.current = null;
    sawRequestRef.current = false;
    setHasInteracted(false);
    setCanClearSession(false);
    setSessionError('');
  };

  const endSession = async () => {
    if (endingRef.current || (busyRef.current && !isLoading) || !sessionRef.current) return;
    endingRef.current = true;
    busyRef.current = true;
    setSessionBusy(true);
    setSessionError('');
    try {
      await stop();
      const response = await fetch('/api/session', {
        method: 'DELETE', headers: {
          'Content-Type': 'application/json', 'x-browsegpt-client': '1',
          'x-browsegpt-session': sessionRef.current.capability,
        }, body: '{}',
      });
      if (response.status === 401) {
        setCanClearSession(true);
        throw new Error('This session credential is no longer accepted. Clear the conversation to start again. An unreleased browser will expire automatically.');
      }
      if (!response.ok) throw new Error('Could not end the browser session. Please retry.');
      clearConversation();
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Could not end the browser session. Please retry.');
    } finally {
      endingRef.current = false;
      busyRef.current = false;
      setSessionBusy(false);
    }
  };

  const handleSubmitWrapper = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void submitText(input);
  };

  const handlePromptClick = (text: string) => { void submitText(text); };

  return (
    <div className="flex flex-col min-h-screen relative">
      <FlickeringGrid className="fixed inset-0 z-0 h-full w-full" />
      <div className="relative z-10 flex flex-col min-h-screen items-center"> 
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 z-20">
          <div className="w-full max-w-2xl mx-auto border-x-2 border-b-2 border-[#E5E7EB] bg-white">
            <div className="px-4 py-4 flex justify-between items-center">
              <a href="https://www.alexdphan.com" target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline">Made by AP</a>
              <h1 className="text-2xl font-bold flex items-center">
                <a href="https://www.browserbase.com" target="_blank" rel="noopener noreferrer" className="mr-1">
                  <BrowserbaseLogo />
                </a>
                <span className="mx-1">x</span>
                <a href="https://www.vercel.com" target="_blank" rel="noopener noreferrer">
                  <VercelLogo />
                </a>
              </h1>
            </div>
          </div>
        </div>

        {/* Chat content */}
        <div className="flex-grow flex flex-col w-full max-w-2xl mx-auto border-x-2 border-[#E5E7EB] bg-white mt-16">
          <div className="flex-grow flex flex-col w-full max-w-xl mx-auto py-4 px-4"> {/* Added px-4 */}
            {sessionError && <p role="alert" className="my-4 text-red-700">{sessionError}</p>}
            {(error || status === 'error') && (
              <section role="alert" className="my-4 space-y-2 text-red-700">
                <p>Your request could not be completed. Your conversation and any partial response are preserved.</p>
                <button type="button" disabled={isLoading || sessionBusy} onClick={editAndResubmit}
                  className="underline disabled:opacity-50">Edit and resubmit</button>
              </section>
            )}
            {canClearSession && <button type="button" disabled={sessionBusy || isLoading} onClick={clearConversation} className="underline">
              Clear conversation
            </button>}
            {browserSession && (
              <section className="my-4 space-y-2" aria-label="Browser session">
                <button type="button" disabled={sessionBusy && (!isLoading || endingRef.current)} onClick={() => void endSession()} className="underline disabled:opacity-50">
                  End session
                </button>
                <iframe src={browserSession.debuggerUrl} title="Browser session" className="w-full sm:h-72 h-52"
                  sandbox="allow-same-origin allow-scripts" allow="clipboard-read; clipboard-write" />
              </section>
            )}
            {!hasInteracted && messages.length === 0 ? (
              <div className="flex-grow flex flex-col justify-start items-center text-center mt-56">
                <BlurFade>
                <h2 className="sm:text-2xl font-bold mb-2 text-xl">Welcome</h2>
              
                <p className="sm:mb-10 mb-8 sm:text-sm text-xs">What web task can I conquer for you today?</p>
                </BlurFade>
                <Prompts onPromptClick={handlePromptClick} />
              </div>
            ) : (
              messages.map((m, index) => (
                <div key={m.id} className="whitespace-pre-wrap">
                  {m.role === 'user' ? (
                    <>
                      <strong className="block mb-0 text-xl pb-2">User:</strong>
                      <p className="mt-0 pb-4 font-mono">{messageText(m)}</p>
                    </>
                  ) : (
                    <>
                      <strong className="flex items-center text-xl pb-4">
                        <a href="https://www.browserbase.com" target="_blank" rel="noopener noreferrer"><BrowserbaseLogo /></a>
                        <span className="ml-1">-AI:</span>
                      </strong>
                      <div className={index === messages.length - 1 ? 'mb-20' : ''}>
                        {m.parts.map((part, partIndex) => {
                          if (part.type === 'text') return (
                            <div key={partIndex} className="font-mono prose prose-sm mt-0 leading-snug pb-4">
                              <MarkdownWrapper><Markdown remarkPlugins={[remarkGfm]}>{part.text}</Markdown></MarkdownWrapper>
                            </div>
                          );
                          if (!isToolUIPart(part)) return null;
                          const tp = part as ToolPartLoose;
                          const out = tp.state === 'output-available' ? tp.output : undefined;
                          const toolName = tp.type === 'dynamic-tool' ? tp.toolName : tp.type.slice(5);
                          const failed = tp.state === 'output-error' || tp.state === 'output-denied';
                          return (
                            <Alert key={partIndex} className="my-4 border-[#E5E7EB]">
                              <AlertTitle>{toolName || 'Tool'}</AlertTitle>
                              <AlertDescription>
                                {failed ? <p>The tool could not complete this step.</p> : toolName === 'askForConfirmation' && tp.toolCallId ? (
                                  <div className="space-y-3">
                                    <p>{typeof tp.input?.message === 'string' ? tp.input.message : 'Waiting for the confirmation question…'}</p>
                                    {tp.state === 'input-available' ? (
                                      <Confirmation busy={isLoading || sessionBusy || !browserSession || Boolean(error)}
                                        onAnswer={confirmed => addToolOutput({
                                          tool: 'askForConfirmation', toolCallId: tp.toolCallId!, output: { confirmed },
                                        })} />
                                    ) : tp.state === 'output-available' ? <p>{out?.confirmed === true ? 'Confirmed' : 'Declined'}</p>
                                      : <p>Preparing confirmation…</p>}
                                  </div>
                                ) : tp.state === 'output-available' ? (
                                  <div className="overflow-x-auto">
                                    <p>Tool completed.</p>
                                    {out !== undefined && <pre className="whitespace-pre-wrap break-all">{
                                      typeof out?.content === 'string' ? `Content: ${out.content}` : JSON.stringify(out, null, 2)
                                    }</pre>}
                                  </div>
                                ) : <p>{tp.state === 'input-streaming' ? 'Preparing tool request…' : 'Tool is waiting or running…'}</p>}
                              </AlertDescription>
                            </Alert>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}

            {showAlert && lastMessage?.role === 'assistant' && (
              <BlurFade>
                <Alert className="my-4 border-[#E5E7EB] mb-20">
                  <div className="flex justify-between items-center">
                    <div>
                      <AlertTitle>
                        {lastMessage.parts
                          .filter(isToolUIPart)
                          .map((part) => {
                            const tp = part as ToolPartLoose;
                            const out =
                              tp.state === 'output-available'
                                ? (tp.output as { toolName?: string } | undefined)
                                : undefined;
                            if (out?.toolName) return out.toolName;
                            const input = tp.input as { toolName?: string } | undefined;
                            return input?.toolName;
                          })
                          .filter(Boolean)
                          .join(', ')}
                      </AlertTitle>
                      <AlertDescription>{statusMessage}</AlertDescription>
                    </div>
                      <FlickeringLoad height={50} width={60} className='p-1'/>
                  </div>
                </Alert>
              </BlurFade>
            )}
          </div>
        </div>

        {/* Input form */}
        <div className="fixed bottom-0 left-0 right-0 z-20">
          <div className="w-full max-w-2xl mx-auto px-4 py-8 border-x-2 border-[#E5E7EB] ">
            <div className="w-full max-w-xl mx-auto">
              <form onSubmit={handleSubmitWrapper} className="w-full relative">
                <input
                  ref={inputRef}
                  className="w-full p-2 pr-10 border border-[#E5E7EB] transition-all duration-200 ease-in-out shadow-md shadow-gray-300/50 focus:border-red-300 focus:shadow-lg focus:shadow-red-300/40 outline-none"
                  value={input}
                  placeholder="Ask anything..."
                  onChange={(e) => setInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!input.trim() || isLoading || sessionBusy}
                >
                  <span className="text-xl font-bold">&gt;</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
