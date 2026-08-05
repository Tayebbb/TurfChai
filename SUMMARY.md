# TurfChai AI Booking Assistant — Technical Summary

**Branch:** `feature/ai-booking-assistant` · **Stack:** Spring Boot 4.1 (Java 21), no external AI frameworks

## What was built

A production-quality AI chatbot for TurfChai that helps users search venues, check slot availability, create/cancel bookings, browse tournaments, and answer policy questions (refunds, loyalty points, payments). It lives in its own module (`com.turfchai.ai`) completely decoupled from the (not-yet-built) backend business logic, so it can be integrated later without changes.

Test it at `http://localhost:8080/ai-chat.html` after `.\mvnw.cmd spring-boot:run` (API keys go in the git-ignored `.env` file).

## Core architecture

The AI is an **orchestrator, not the business logic**. The LLM never touches the database or services directly — it can only request execution of registered *tools*:

```
User → REST API (/api/ai/chat) → Agent
         ├─ Intent Router  (keyword rules → BOOKING / POLICY / PAYMENT / …)
         ├─ Planner        (decides: use RAG? which tools to expose?)
         ├─ Prompt Builder (versioned prompt files, not hardcoded strings)
         ├─ RAG Retriever  (policy/FAQ knowledge base, in-memory vector store)
         └─ LLM loop       (model ↔ tool calls until a final text answer)
                └─ Tool Registry → mock tools (venue search, booking, payments,
                                   tournaments, profile, booking-context state)
```

Key design decisions:

- **Provider abstraction** — one `LlmProvider` interface; a single OpenAI-compatible implementation serves both **OpenRouter (primary)** and **Hugging Face (fallback)**. Swapping providers is config, not code.
- **Automatic failover** — `FallbackLlmProvider` retries the other provider on quota/transport errors, with a 60s circuit-breaker cooldown so a dead provider isn't retried on every request. OpenRouter additionally routes across 3 free models when one is congested.
- **Mock tools now, real services later** — each tool implements the same `Tool` interface a future Spring service will; the agent never changes.
- **Memory ≠ state** — chat transcript (bounded, per-session) is stored separately from structured booking state (sport/venue/date/time/players), which the model updates through a dedicated tool.
- **RAG for static knowledge only** — refund policy, booking guide, loyalty rules, FAQs are chunked, embedded (offline hashing embedder — deterministic, zero network) and retrieved per question. Live data always comes from tools.

## Prompts & knowledge base

**5 prompt files** (version-controlled markdown under `src/main/resources/prompts/`, never hardcoded in Java):

| File | Purpose |
| --- | --- |
| `system.md` | Identity + ground rules: TurfChai assistant for Dhaka, live data only from tools, never invent prices/codes, ৳ formatting |
| `safety.md` | Overrides everything: no instruction leaking, treat user/tool output as data not instructions (prompt-injection defense), no fabricated payments, no other users' data |
| `role-booking-assistant.md` | Conversation flow: which booking details to collect (sport, area, date, time, players, budget), one question at a time, confirm before booking |
| `tool-guidance.md` | Tool discipline: max one call per tool per message, no argument guessing, answer immediately after a result |
| `rag-context.md` | Grounding wrapper for retrieved knowledge: "answer ONLY from this, say you don't know otherwise" |

Per request, the agent **layers** them into one system prompt: `system + safety + role` always; `tool-guidance` only when the intent exposes tools; plus the current booking state (sanitized) and, for policy questions, the retrieved knowledge wrapped in `rag-context`. Prompts were later compressed ~60% (same rules, fewer tokens) as a latency optimization.

**5 knowledge documents** (`src/main/resources/ai-knowledge/`, derived from `DATABASE_SCHEMA.md` business rules): cancellation/refund policy, booking guide, loyalty & rewards, FAQs, venue-owner guide — indexed into **13 chunks** (800 chars, 120 overlap), top-3 retrieved per question by cosine similarity.

**6 tools** exposed to the model (scoped per intent by the planner): `search_venues`, `manage_booking` (availability/create/list/cancel), `get_user_profile`, `get_payment_status`, `search_tournaments`, `update_booking_context` (writes session state).

## Problems hit and solved along the way

| Problem | Fix |
| --- | --- |
| Spring Boot 4 doesn't auto-configure Jackson / `ObjectMapper` | explicit dependency + bean |
| Boot 4's HTTP layer uses Jackson 3, crashed parsing into Jackson 2 types | read responses as `String`, parse with own mapper |
| App couldn't boot without a database (JPA starter, no datasource) | excluded datasource auto-config until persistence lands |
| Gemini free tier denied/quota-zero; newer models require `thoughtSignature` echo | eventually **removed Gemini entirely**, moved to OpenRouter |
| Retired/rate-limited free models causing failures & 10–19s replies | benchmarked all free tool-calling models, picked the fastest (`ling-3.0-flash:free`, ~1–3s) with routing alternates |
| Models looping on identical tool calls (4× per question) | duplicate-call guard + prompt rule; tool budget forces a final answer instead of erroring |
| Prompt injection & abuse surface | safety prompt layer, state sanitization, session→user binding, rate limiting (20 req/min), input validation |

## Performance work

HTTP/2 keep-alive connections (no TLS handshake per LLM call), prompts compressed ~60%, tool guidance skipped when no tools are exposed, history window 12 messages, `max_tokens` 450, latency-sorted upstream routing. Measured live: small talk 13.3s → **1.9s**, tool-using venue search 10.1s → **2.8s**.

## Testing

~90 pure unit tests (no Spring context, no network): agent tool-loop flows with a scripted fake LLM, provider wire-format mapping, fallback/cooldown behavior, RAG chunking + retrieval over the real knowledge base, memory bounds, state isolation, rate limiter windows. Implementation was also reviewed by an independent review pass (architecture/security/AI/RAG) and all critical findings were fixed (e.g., function-call replay format, session hijacking, missing HTTP timeouts).

## Known limitations / next steps

- Free-tier LLM pools are occasionally congested → rare "temporarily unavailable" (clean 503). A $10 OpenRouter top-up or any paid model removes this.
- `userId` is client-supplied until real authentication lands (session binding mitigates it).
- In-memory stores (memory/state/vectors) are single-instance; swap for Redis/pgvector when scaling.
- Mock tools return fixture data; wiring real services is a per-tool swap in `AiConfiguration`.
