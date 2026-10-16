# Vendored grammars

The C and C++ grammars the syntax layer parses with (ROADMAP Q-013), as the `.wasm` files their npm packages ship.
They are vendored, not installed: the grammar packages run a native build (`node-gyp-build`) on install, which the
crawler never needs. The runtime, `web-tree-sitter`, is an ordinary dependency pinned in `package.json`.

`GRAMMARS.json` records each file's package, version and sha256. `crawler/syntax.ts` refuses to load a grammar
whose hash differs, and `crawler/syntax.test.ts` (run by `./verify fast`) checks every hash.

## Refresh a grammar

From an empty scratch directory outside the repo (nothing is installed, no package script runs):

```
npm pack tree-sitter-cpp@<version>
tar -xzf tree-sitter-cpp-<version>.tgz
shasum -a 256 package/tree-sitter-cpp.wasm
```

Copy `package/tree-sitter-cpp.wasm` and `package/LICENSE` here, update `GRAMMARS.json`, and check that the
grammar's ABI is one the pinned `web-tree-sitter` loads (the syntax test fails if it is not). A grammar change can
change parse trees, so expect the syntax golden to move; review that diff as a crawler change.
