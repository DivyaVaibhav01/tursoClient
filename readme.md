<div align="center">

# 🚀 Turso Redis Client

### *Redis-like Key-Value Store on Turso (SQLite)*

[![Bun](https://img.shields.io/badge/Bun-1.3.14-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Turso](https://img.shields.io/badge/Turso-Cloud-4F46E5?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyQzIgMTcuNTIgNi40OCAyMiAxMiAyMkMxNy41MiAyMiAyMiAxNy41MiAyMiAxMkMyMiA2LjQ4IDE3LjUyIDIgMTIgMloiIGZpbGw9IiM0RjQ2RTUiLz4KPHBhdGggZD0iTTEyIDZMMTYgMTJMMTIgMThMOCAxMkwxMiA2WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+&logoColor=white)](https://turso.tech)

[![npm version](https://img.shields.io/npm/v/turso-redis-client?style=flat-square&color=4F46E5)](https://www.npmjs.com/package/turso-redis-client)
[![License](https://img.shields.io/badge/License-MIT-4F46E5?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-4F46E5?style=flat-square)](CONTRIBUTING.md)

</div>

---

<div align="center">

## 🎨 Interactive 3D Preview

```ascii
    .---.        .---.        .---.
   /     \      /     \      /     \
  |  🔥   |    |  🚀   |    |  ⚡   |
   \     /      \     /      \     /
    '---'        '---'        '---'
    Redis        Turso        Cache
    Like         Power        Layer
```
</div>

# 📦 Tech Stack

<div align="center">
Technology	Logo	Description
Turso	<img src="https://avatars.githubusercontent.com/u/109169772?s=48&v=4" width="32" height="32">	Distributed SQLite Database
Bun	<img src="https://bun.sh/logo.svg" width="32" height="32">	JavaScript Runtime & Toolkit
Node.js	<img src="https://nodejs.org/static/images/logo.svg" width="32" height="32">	JavaScript Runtime
TypeScript	<img src="https://www.typescriptlang.org/icons/icon-48x48.png" width="32" height="32">	Typed JavaScript
</div>


# ✨ Features

```mermaid
<div align="center">
graph LR
    A[🚀 Redis-like API] --> B[⏱️ TTL Support]
    B --> C[🔄 Atomic Ops]
    C --> D[🎯 Batch Operations]
    D --> E[🗄️ Persistent Storage]
    E --> F[🧹 Auto Cleanup]
    F --> G[📊 Pattern Matching]
    G --> H[🔒 Distributed Locks]
</div>
```
# Commands
<div align="center">
🎯 Core Commands
Command	Description	3D Visualization
set(key, value, ttl?)	Store a value	📦 ➔ 📝
get(key)	Retrieve a value	📝 ➔ 📦
del(...keys)	Delete keys	🗑️ ➔ ❌
exists(key)	Check existence	🔍 ➔ ✅

⏱️ TTL Commands
Command	Description	3D Visualization
ttl(key)	Get remaining time	⏱️ ➔ 📊
expire(key, seconds)	Set expiration	📅 ➔ ⏰
persist(key)	Remove TTL	⏰ ➔ ♾️

🔢 Numeric Commands
Command	Description	3D Visualization
incr(key)	Increment by 1	📊 ➔ 📈
incrby(key, n)	Increment by n	📊 ➔ 📈📈
decr(key)	Decrement by 1	📊 ➔ 📉

🔍 Scan Commands
Command	Description	3D Visualization
keys(pattern)	List keys	🔑 ➔ 📋
scan(cursor, pattern)	Paginate keys	📄 ➔ 📑
</div>

