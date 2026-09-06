# Turso Client

**A key value store built on Turso (SQLite)**

[![Bun](https://img.shields.io/badge/Bun-1.3.14-000000?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## Overview

Turso Client gives you a familiar Redis-style API system — backed by [Turso](https://turso.tech), 
Turso is a distributed SQLite database. 
Use tursoClient it when you want Redis-like ergonomics without running a separate Redis instance, and you're already on (or want) SQLite-based storage.

## Tech Stack

| Technology | Purpose |
|---|---|
| [Turso](https://turso.tech) | Distributed SQLite database (storage layer) |
| [Bun](https://bun.sh) | Primary JS runtime & toolkit |
| [Node.js](https://nodejs.org) 18+ | Alternative runtime |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe client API |

## Features

- **Redis-like API** — familiar method names and semantics
- **TTL support** — expire keys automatically
- **Atomic operations** — safe increments/decrements
- **Batch operations** — operate on multiple keys at once
- **Persistent storage** — durable, backed by SQLite
- **Auto cleanup** — expired keys are purged automatically
- **Pattern matching** — `keys()` and `scan()` support glob patterns
- **Distributed locks** — coordinate across processes

## Architecture

A quick look at how a command flows from your app down to Turso's edge storage:

```mermaid
flowchart LR
    subgraph App["🖥️ Your App"]
        A[Client SDK]
    end
    subgraph Layer["⚡ Turso Client"]
        B[Command Router]
        C[TTL Engine]
        D[Batch Executor]
    end
    subgraph Storage["🗄️ Turso · SQLite Edge"]
        E[(Key-Value Table)]
        F[(Expiry Index)]
    end

    A -->|get / set / incr| B
    B --> C
    B --> D
    C --> F
    D --> E
    E -.->|auto-purge expired| F

    style App fill:#0a1a12,color:#fff,stroke:#4FF8D2
    style Layer fill:#0c2418,color:#fff,stroke:#4FF8D2
    style Storage fill:#050805,color:#fff,stroke:#4FF8D2
```

## Installation

```bash
# Bun
bun add turso-client

# npm
npm install turso-client
```

## Quick Start

```ts
import { createClient } from "turso-client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

await client.set("session:123", "active", 3600); // expires in 1h
const value = await client.get("session:123");
```

## Commands

### Core

| Command | Description |
|---|---|
| `set(key, value, ttl?)` | Store a value, optionally with a TTL (seconds) |
| `get(key)` | Retrieve a value |
| `del(...keys)` | Delete one or more keys |
| `exists(key)` | Check whether a key exists |

### TTL

| Command | Description |
|---|---|
| `ttl(key)` | Get remaining time-to-live for a key |
| `expire(key, seconds)` | Set/update a key's expiration |
| `persist(key)` | Remove a key's TTL (make it permanent) |

### Numeric

| Command | Description |
|---|---|
| `incr(key)` | Increment a value by 1 |
| `incrby(key, n)` | Increment a value by `n` |
| `decr(key)` | Decrement a value by 1 |

### Scan

| Command | Description |
|---|---|
| `keys(pattern)` | List keys matching a glob pattern |
| `scan(cursor, pattern)` | Paginate through keys matching a pattern |
## License

[MIT](LICENSE)
