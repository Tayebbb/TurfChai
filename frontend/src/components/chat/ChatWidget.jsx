import { useCallback, useEffect, useRef, useState } from 'react';
import { forgetSession, getSessionId, resetSession, sendMessage } from '@/api/assistant';
import { RichText } from './RichText';
import './ChatWidget.css';

const GREETING = {
  id: 'greeting',
  role: 'assistant',
  text: 'Salam! I’m **Chai**, your TurfChai assistant.\nAsk me to find a turf, check prices, or explain a booking policy.',
};

const SUGGESTIONS = [
  'Find a 7-a-side turf in Dhanmondi',
  'What’s the cheapest slot tonight?',
  'What’s the cancellation policy?',
];

/** Distinguishes "not configured" from "rate limited" from "offline". */
function errorMessage(error) {
  const status = error?.status;
  if (status === 429) return 'You’re sending messages a bit fast — give it a moment.';
  if (status === 503) {
    return 'The assistant isn’t available right now. If you’re running this locally, check that OPENROUTER_API_KEY or HF_API_KEY is set in your .env file.';
  }
  if (status >= 400 && status < 500 && error?.message) return error.message;
  if (status >= 500) return 'The assistant hit an error handling that. Try rephrasing your question.';
  return 'Couldn’t reach the assistant — check your connection and that the backend is running.';
}

const DropletIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path
      d="M12 2.5c3.6 4.2 6.5 7.7 6.5 11.1A6.5 6.5 0 0 1 12 20.5a6.5 6.5 0 0 1-6.5-6.9C5.5 10.2 8.4 6.7 12 2.5z"
      fill="currentColor"
    />
    <path
      d="M9.4 13.9c0-1.6 1.1-3.1 2.3-4.6"
      fill="none"
      stroke="rgba(255,255,255,.65)"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const panelRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else launcherRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, pending]);

  const ask = useCallback(
    async (text) => {
      const question = text.trim();
      if (!question || pending) return;

      setError(null);
      setDraft('');
      setMessages((current) => [
        ...current,
        { id: `u-${Date.now()}`, role: 'user', text: question },
      ]);
      setPending(true);

      try {
        const response = await sendMessage(question, getSessionId());
        setMessages((current) => [
          ...current,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: response.reply,
            tools: response.toolsUsed ?? [],
          },
        ]);
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setPending(false);
      }
    },
    [pending],
  );

  const startOver = async () => {
    const sessionId = getSessionId();
    setMessages([GREETING]);
    setError(null);
    try {
      await resetSession(sessionId);
    } catch {
      /* clearing locally is enough for the user */
    }
    forgetSession();
  };

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className={`chat-launcher${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-controls="chat-panel"
        aria-label={open ? 'Close the TurfChai assistant' : 'Open the TurfChai assistant'}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="chat-launcher-glow" aria-hidden="true" />
        {open ? (
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <DropletIcon />
        )}
      </button>

      {open ? (
        <div
          id="chat-panel"
          className="chat-panel"
          role="dialog"
          aria-modal="false"
          aria-label="TurfChai assistant"
          ref={panelRef}
        >
          <header className="chat-head">
            <span className="chat-avatar" aria-hidden="true">
              <DropletIcon />
            </span>
            <div className="chat-head-text">
              <b>Chai</b>
              <span>Booking assistant</span>
            </div>
            <button type="button" className="chat-ghost" onClick={startOver}>
              New chat
            </button>
            <button
              type="button"
              className="chat-icon-btn"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>

          <div className="chat-log" ref={listRef} role="log" aria-live="polite" aria-atomic="false">
            {messages.map((message) => (
              <div key={message.id} className={`chat-row ${message.role}`}>
                <div className="chat-bubble">
                  <RichText text={message.text} />
                  {message.tools?.length ? (
                    <div className="chat-tools">
                      {message.tools.map((tool) => (
                        <span key={tool} className="chat-tool">
                          {tool.replaceAll('_', ' ')}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {pending ? (
              <div className="chat-row assistant">
                <div className="chat-bubble chat-typing" aria-label="Assistant is typing">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="chat-error" role="alert">
                {error}
              </div>
            ) : null}
          </div>

          {messages.length === 1 && !pending ? (
            <div className="chat-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => ask(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          <form
            className="chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              ask(draft);
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={draft}
              maxLength={2000}
              placeholder="Ask about turfs, prices, bookings…"
              aria-label="Message the assistant"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" aria-label="Send message" disabled={pending || !draft.trim()}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M4 12l16-8-6 8 6 8-16-8z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
