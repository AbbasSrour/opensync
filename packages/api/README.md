# @opensync/api

Convex schema, functions, HTTP actions, generated API types, and docs sync scaffolding for OpenSync.

Source files live in `convex/`, matching the conventional directory expected by the Convex CLI.

Useful commands from the repo root:

```bash
vp run @opensync/api#convex
vp run @opensync/api#convex:deploy
```

The generated API is re-exported from the package root for frontend imports:

```ts
import { api } from "@opensync/api";
import type { Id } from "@opensync/api";
```
