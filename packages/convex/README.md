# @opensync/convex

Convex schema, functions, HTTP actions, generated API types, and docs sync scaffolding for OpenSync.

Source files live in `src/`. A `convex -> src` symlink is kept so the Convex CLI can use its conventional `convex/` directory while the package remains organized as a normal workspace package.

Useful commands from the repo root:

```bash
vp run @opensync/convex#convex
vp run @opensync/convex#convex:deploy
```

The generated API is re-exported from the package root for frontend imports:

```ts
import { api } from "@opensync/convex";
import type { Id } from "@opensync/convex";
```
