# Backend Spec — ai-chat-streaming: AI Chat with SSE Streaming

## Goal

Set up the OpenAI SDK (pointed at Ollama) and expose authenticated SSE streaming and history endpoints so users can chat with a meal-prep AI assistant.

## Scope

**In scope:**
- Install and configure the `openai` npm package with Ollama's base URL
- `chat` NestJS module with service, controller, and entity
- `POST /chat/message` — sends a user message and streams the assistant reply via SSE
- `GET /chat/history` — returns the authenticated user's full message history
- `chat_messages` table to persist messages (one conversation per user)
- JWT auth guard on both endpoints

**Out of scope:**
- RAG / context injection from the user's meal-prep data
- Multiple conversations per user
- Message deletion or conversation reset
- Frontend UI (deferred)

## Data Model Changes

| Change | Type | Notes |
|--------|------|-------|
| `chat_messages` table | New table | Stores all messages for all users |

### `chat_messages` schema

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | default `gen_random_uuid()` |
| `user_id` | `uuid` FK → `users.id` | cascade delete |
| `role` | `varchar` | `'user'` or `'assistant'` |
| `content` | `text` | message body |
| `created_at` | `timestamptz` | default `now()` |

Migration file: `src/migrations/<timestamp>-CreateChatMessages.ts`

## API Contract

### `POST /chat/message`
**Auth:** JWT required

**Request**
```json
{
  "message": "What should I meal prep this week?"
}
```

**Response** — `Content-Type: text/event-stream`

Each SSE event delivers one text delta:
```
data: {"delta": "Here"}
data: {"delta": " are"}
data: {"delta": " some ideas..."}
data: [DONE]
```

The `[DONE]` sentinel signals the stream is closed.

**Error cases**
| Status | Condition |
|--------|-----------|
| 400 | `message` is missing or empty |
| 401 | Missing or invalid JWT |
| 502 | Ollama/OpenAI upstream unreachable or returned an error |

---

### `GET /chat/history`
**Auth:** JWT required

**Response 200**
```json
[
  {
    "id": "uuid",
    "role": "user",
    "content": "What should I meal prep this week?",
    "createdAt": "2026-05-29T12:00:00.000Z"
  },
  {
    "id": "uuid",
    "role": "assistant",
    "content": "Here are some ideas...",
    "createdAt": "2026-05-29T12:00:01.000Z"
  }
]
```

**Error cases**
| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT |

## Business Logic

### `POST /chat/message`

1. Validate that `message` is a non-empty string, trimmed length ≤ 4000 chars.
2. Persist the user message to `chat_messages` (`role: 'user'`).
3. Fetch the full conversation history for this user from `chat_messages`, ordered by `created_at` ASC, and map to OpenAI message format (`{ role, content }`).
4. Prepend the meal-prep system prompt as `{ role: 'system', content: '...' }` at the start of the messages array.
5. Call `openai.chat.completions.create({ stream: true, model, messages })` using the configured Ollama base URL and model.
6. Set response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
7. For each streaming chunk, extract the delta text and write `data: {"delta": "<text>"}\n\n` to the response.
8. When the stream ends, accumulate the full assistant reply, persist it to `chat_messages` (`role: 'assistant'`), write `data: [DONE]\n\n`, and close the response.
9. On upstream error, log it and write a 502 response (if headers not yet sent) or close the stream with an error event.

### `GET /chat/history`

1. Query `chat_messages` for the authenticated user, ordered by `created_at` ASC.
2. Return the array.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OLLAMA_BASE_URL` | Ollama API base URL | `http://localhost:11434/v1` |
| `OLLAMA_MODEL` | Model name to use | `llama3.2` |

## Background Jobs / Events

None.

## Security Considerations

- Both endpoints require a valid JWT — enforced by the global `JwtAuthGuard`.
- `user_id` is taken from the JWT payload, never from the request body.
- `message` content should be trimmed and length-capped (e.g. 4000 chars) before forwarding to Ollama to avoid prompt injection via extremely large inputs.
- `OLLAMA_BASE_URL` and `OLLAMA_MODEL` must be set via env and never hard-coded.

## Tests

### Unit tests

| Scenario | Expected outcome |
|----------|-----------------|
| `ChatService.sendMessage` — valid message | Persists user message, fetches history, calls OpenAI stream |
| `ChatService.sendMessage` — Ollama unreachable | Throws a mapped 502 exception |
| `ChatService.getHistory` — user has messages | Returns messages ordered by `created_at` ASC |
| `ChatService.getHistory` — user has no messages | Returns empty array |

### Integration / e2e tests

| `METHOD /path` | Case | Expected status |
|----------------|------|----------------|
| `POST /chat/message` | Valid JWT + message | 200 (stream opens) |
| `POST /chat/message` | No JWT | 401 |
| `POST /chat/message` | Empty `message` | 400 |
| `GET /chat/history` | Valid JWT, messages exist | 200 |
| `GET /chat/history` | No JWT | 401 |

## System Prompt

The following system prompt is injected as the first message (`role: "system"`) on every request, before the conversation history:

```
You are mise, an expert meal-prep assistant. Your sole focus is helping users plan, prepare, and optimise their weekly meals.

You help with:
- Building weekly meal-prep plans tailored to dietary needs, time constraints, and skill level
- Suggesting recipes that batch well and store safely
- Estimating macros and portion sizes
- Reducing food waste through smart ingredient reuse
- Shopping list generation and pantry management

Guidelines:
- Keep responses practical and concise — users are busy home cooks, not professional chefs
- If a question is outside the scope of meal prep and cooking, politely redirect the conversation back to food
- Never invent nutritional data; acknowledge uncertainty when exact values are unknown
- Avoid dietary prescriptions (e.g. "you should eat less fat") — offer options, not mandates
```

## Open Questions

- [x] Max message length cap — **4000 chars**.
