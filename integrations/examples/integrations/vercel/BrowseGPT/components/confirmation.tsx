'use client';

import { useRef, useState } from 'react';

type ConfirmationProps = {
  busy: boolean;
  onAnswer: (confirmed: boolean) => void | PromiseLike<void>;
};

export function Confirmation({ busy, onAnswer }: ConfirmationProps) {
  const submitted = useRef(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function answer(confirmed: boolean) {
    if (busy || submitted.current) return;
    submitted.current = true;
    setSending(true);
    setError('');
    try {
      await onAnswer(confirmed);
    } catch {
      submitted.current = false;
      setSending(false);
      setError('Your response could not be sent. Please try again.');
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <button type="button" disabled={busy || sending} className="border rounded px-3 py-2 disabled:opacity-50" onClick={() => void answer(true)}>Confirm</button>
        <button type="button" disabled={busy || sending} className="border rounded px-3 py-2 disabled:opacity-50" onClick={() => void answer(false)}>Decline</button>
      </div>
      {sending && <p role="status">Sending your response…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
