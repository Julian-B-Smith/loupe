> **Scout report, kept as an appendix.** Written by a research subagent (Sonnet) on 2026-10-10 from web searches and summarised page fetches. Only the claims listed as verified in [../prior-art.md](../prior-art.md) were checked by the lead against primary sources; treat everything else here as unverified.

# PA scout 4: code graph extraction and indexing prior art

Origin: loupe lead session, 2026-10-10, ROADMAP phase PA (amendment pass, Decision 40), informing P1. Author: scout 4 (graph extraction lane).
Method note: every page below was fetched 2026-10-10 through a summarising fetcher (a small model condensed each page), so wording is paraphrase, not verbatim, and a page's own publication date is usually not shown; where a primary date is known it is given. Items I could not fetch or confirm are marked UNVERIFIED. Several fetches returned 404 or empty summaries (clang-scan-deps docs page, tree-sitter-cpp README, universal-ctags JSON/roles docs, Understand, Semgrep, LSIF spec, TypeScript compiler API, Kythe determinism): these are NOT covered with evidence.

## 1. Tools table

| Tool | Extracts | Precision | Needs | Languages | Licence | No native build? | Determinism | Output | Status (checked 2026-10-10) |
|---|---|---|---|---|---|---|---|---|---|
| tree-sitter + web-tree-sitter | Concrete syntax trees; tags queries give def/ref/call names | Syntactic only | Nothing | Many grammars | MIT (core, tree-sitter-c, -cpp) | Yes (WASM). Docs say Node WASM is slower than native bindings | Not stated in docs (UNVERIFIED); parsing a fixed input with fixed grammar version is expected to be repeatable but pin grammar wasm hashes | In-memory tree | Active; web-tree-sitter 0.25+ supports ABI 13-15 |
| tree-sitter tags / GitHub stack-graphs | Tags: def/ref by name, no resolution. Stack-graphs: real name resolution rules per language, no build | Tags: syntactic; stack-graphs: semantic-ish | Nothing | Tags many; stack-graphs few | Apache-2.0/MIT | Rust (WASM not claimed) | n/a | n/a | stack-graphs repo ARCHIVED 2025-09-09, "no longer supported" |
| SCIP | Protobuf index: documents, occurrences, symbols, relationships | Semantic (as good as the indexer) | An indexer per language | Indexers: Java, TS, Rust, C++, Python, C#, Ruby, PHP, Dart | Apache-2.0 | Format itself is just protobuf | Typed, human-readable symbol ids (by design) | .scip protobuf | Active |
| scip-clang | SCIP for C/C++ | Semantic (Clang AST) | compile_commands.json AND a prior build (generated code must exist); no PCH | C, C++, CUDA | Apache-2.0 | NO: native binary (x86_64 Linux, arm64 macOS provided) | Not documented (UNVERIFIED) | .scip | Beta |
| LSIF | Graph of LSP results | Semantic | LSP server | many | MIT-ish (UNVERIFIED) | n/a | Opaque global ids | JSON lines | Superseded by SCIP (Sourcegraph post, 2022-06-08) |
| Kythe | Cross-reference graph with schema | Semantic (C++ via Clang) | Build interception/extractors | C++, Go, Java; extractors for Bazel, cmake, Maven | Apache-2.0 | NO | UNVERIFIED | Kythe graph/proto | Repo active (5.5k commits) |
| clangd index / clangd-indexer | Symbols, refs, relations | Semantic | compile_commands.json | C/C++ | Apache-2.0 w/ LLVM exc. | NO (LLVM) | Cached .idx | .idx binary | Active |
| libclang / clang -MJ / -H / -MMD | AST; per-TU compile command fragments; actual include trees | Exact for the configuration compiled | Clang + flags | C/C++ | Apache-2.0 w/ LLVM exc. | NO | Deterministic per config | JSON / text | Active |
| clang-scan-deps | Header and module dependencies of each TU, from a preprocessor-only run | Exact include graph for that config | compile_commands.json; may run before compilation | C/C++ | Apache-2.0 w/ LLVM exc. | NO (ships with LLVM) | Deterministic modulo ordering (sort) | make, full (JSON), P1689 | Active |
| include-what-you-use | Which includes are used | Semantic | Clang matching version | C/C++ | see LICENSE.TXT | NO | n/a | text | Self-described experimental; breaks on Clang updates |
| CodeQL | Relational DB: AST, calls, dataflow | Semantic | Build tracing for C/C++ | C/C++, JS/TS, Python, many | CLI licence restricts to open-source / research / paid GHAS (see C.7) | NO | n/a | proprietary DB | Active; C++20 modules unsupported |
| Joern | Code property graph | Fuzzy-parse, approximate | No build needed | C/C++ (Eclipse CDT), others | Not confirmed from page (UNVERIFIED) | NO (JVM) | UNVERIFIED | graph | Active (UNVERIFIED date) |
| Glean (Meta) | Fact DB | Semantic | clang indexer for C++ | C++, Hack, Haskell, JS, Python; Rust/Go/TS/Java via SCIP/LSIF | BSD | NO | n/a | Glean DB | Active |
| universal-ctags | Definitions per file | Syntactic, no resolution | Nothing | Very many | GPL-2.0 | NO (native); no wasm | Deterministic output with sorting option (UNVERIFIED) | tags, JSON (UNVERIFIED) | Active |
| GNU Global | GTAGS defs, GRTAGS refs, GPATH | Name-based | Nothing | C, C++, others via ctags/pygments | GPL (docs under GFDL) | NO | n/a | database | Active (UNVERIFIED date) |
| Doxygen | File include/included-by graphs, call/caller graphs, XML | Preprocessing evaluated; call graph name-based unless CLANG_ASSISTED_PARSING | Config; Clang optional | C/C++, others | GPL | NO | n/a | XML, dot | Active |
| CMake File API (codemodel v2) | Targets, type, sources (with isGenerated), compile groups with includes/defines/language, link fragments, dependencies, artifacts, backtrace graph | Exact for configured build | A configured build dir (no build run) | any CMake project | BSD-3 | Needs CMake only | Deterministic JSON per config | JSON | In CMake since 3.14 |
| cmake --graphviz | Target-level dependency graph | Target level only | CMake | any | BSD-3 | CMake only | dot | dot | Current |
| cmake --trace-format json-v1 | Every CMake command call with file, line, args | Exact trace | CMake run | any | BSD-3 | CMake only | JSON lines | JSON | Current |
| Bazel query/aquery/cquery | Target graph, action graph, configured graph | query has no configurations; cquery resolves select() | Bazel | any Bazel repo | Apache-2.0 | NO | proto/json/graph | | Current |
| Ninja `-t deps/graph/commands/compdb/inputs/query` | Recorded header deps, build graph, commands | Exact, but deps need a prior build | Ninja build dir | any Ninja | Apache-2.0 | NO | | text/dot/json | Current. NOT usable here: Loupe's target uses Unix Makefiles per user's machine notes |
| Python `ast` / grimp / import-linter | Static import graph with line numbers | Syntactic; dynamic imports invisible | Python | Python | BSD-2 (grimp, import-linter) | grimp has Rust ext. (wheels), pure `ast` is stdlib | Deterministic | Python API | Active |
| dependency-cruiser / madge | JS/TS import graph | Syntactic (Acorn for d-c) | Node | JS, TS, CJS, ESM, dynamic import (d-c) | MIT | Node only | | dot, json, html | Active |
| oxc-resolver | Node/TS module resolution as a function | Exact resolution | Native NAPI or WASM build | JS/TS | MIT | WASM build offered | Deterministic | function | Active |
| Emerge | File-level graph, regex parsing | Syntactic (regex) | Python | C, C++, JS, TS, Python, ... | MIT | Python | | HTML, GraphML, JSON | Active |
| depends (multilang-depends) | 13+ typed dependency kinds (Import/Include, Call, Create...) | Mid: CDT parser for C/C++ | JVM | C/C++, Java, Python, Ruby, Maven | MIT | JVM | | JSON, XML, DOT, PlantUML | Active |
| ast-grep | Structural pattern match over tree-sitter | Syntactic | Native binary or napi | many | MIT | native | | matches | Active |
| srcML | XML-annotated source | Syntactic; preprocessor handling not documented | srcML binary | C, C++, C#, Java, Python | GPL | native | | XML | v1.1.0 |

## 2. Details

### tree-sitter and its limits for C/C++
- Design goals include robust results "in the presence of syntax errors" and a dependency-free C11 runtime; the docs I fetched say nothing about preprocessor handling or determinism guarantees. Source: https://tree-sitter.github.io/tree-sitter/ (fetched 2026-10-10).
- The C/C++ grammars handle preprocessing only partially: no preprocessor runs before parsing, so code that is valid only after macro expansion can produce parse errors, and #if inside a grammar rule is supported in only four syntactic positions (blocks/global scope, enumerator lists, field declaration lists). Evidence: search summary pointing at https://doxide.indii.org/parsing/ , https://github.com/tree-sitter/tree-sitter-cpp/issues/293 and https://github.com/tree-sitter/tree-sitter-c/issues/106 (I did not open the issues themselves; treat the specifics as secondhand).
- Tags queries give `@definition.function`, `@reference.call` etc. by name capture only: https://tree-sitter.github.io/tree-sitter/4-code-navigation.html . No overload, namespace or include resolution.
- web-tree-sitter: runs in Node, but docs warn WASM execution in Node is "considerably slower" than native bindings; grammar `.wasm` must match parser ABI (0.25+ supports 13-15). https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web
- What tree-sitter CAN do for P1: extract `#include "x"`/`<x>` lines (preproc_include nodes, including inside inactive #if branches since it does not evaluate them), `#define`, function definitions, plain call names, string literals (for `web.bind("name")`), Python imports, JS imports, shell `source`. What it cannot: evaluate #if, expand macros, resolve overloads/templates/virtual calls.

### stack-graphs
Archived by GitHub on 2025-09-09, read-only, "no longer supported or updated". Do not build on it. https://github.com/github/stack-graphs

### SCIP, scip-clang, LSIF
- SCIP is a protobuf format with documents, occurrences, symbols, relationships; Apache-2.0; indexers for Java, TS, Rust, C++, Python, C#, Ruby, PHP, Dart. The fetched summary found no native file-to-file dependency edge concept. https://github.com/sourcegraph/scip
- scip-clang needs a compile database and a completed build (generated code must exist), no PCH, binaries for x86_64 Linux and arm64 macOS, Apache-2.0, labelled Beta. https://github.com/sourcegraph/scip-clang
- SCIP replaced LSIF (Sourcegraph post dated 2022-06-08); claims 10x CI speed-up and 4-5x smaller than LSIF (vendor claims). https://sourcegraph.com/blog/announcing-scip

### Kythe, Glean, CodeQL, Joern
- Kythe: C++, Go, Java indexers; extractors hook the build (Bazel, cmake, Maven, javac). https://github.com/google/kythe
- Glean: fact database; C++ indexing uses Clang; ingests SCIP/LSIF for several languages; BSD. https://github.com/facebookincubator/Glean
- CodeQL: C/C++ C89-C23/C++98-C++23, Clang/GCC/MSVC, C++20 modules unsupported. https://codeql.github.com/docs/codeql-overview/supported-languages-and-frameworks/ . CLI licence forbids generating databases in automated analysis/CI for non-open-source code without paid GHAS: https://github.com/github/codeql-cli-binaries/blob/main/LICENSE.md . HORDE's visibility (private?) is UNVERIFIED by me; if private, CodeQL is out.
- Joern: C/C++ frontend on Eclipse CDT, "fuzzy parsing" that imports code without a working build environment; JVM. https://docs.joern.io/ . This is the closest published example of "no build needed, accept approximation".

### clangd, libclang, compile_commands.json, clang-scan-deps
- compile_commands.json entries: `directory`, `file`, `arguments` or `command`, optional `output`. It describes translation units, not headers and not build targets. Generation: `-MJ`, CMake `CMAKE_EXPORT_COMPILE_COMMANDS`, Bear, Bazel extractor. https://clang.llvm.org/docs/JSONCompilationDatabase.html . (That the CMake option works only for Makefile and Ninja generators is my recollection, UNVERIFIED here.)
- clangd background index reads compile_commands.json and stores per-TU `.idx`. https://clangd.llvm.org/design/indexing
- clang-scan-deps: reads the compilation database, runs a preprocessor-only scan, outputs make / full / P1689 formats, designed so it can run before compilation. Source: search-result summary of the LLVM RFC and source (https://lists.llvm.org/pipermail/cfe-dev/2018-November/060074.html , https://llvm.googlesource.com/clang/+/refs/heads/master/tools/clang-scan-deps/ClangScanDeps.cpp). The official docs URL I tried returned 404, so exact flag names (e.g. `--format=make`, `-compilation-database`) are UNVERIFIED; check `clang-scan-deps --help` before depending on them.
- IWYU is tied to Clang versions and "experimental": https://github.com/include-what-you-use/include-what-you-use

### CMake File API, graphviz, trace
- Query by creating `<build>/.cmake/api/v1/query/codemodel-v2` (or client-owned dir, or query.json); kinds: codemodel v2, cache v2, toolchains v1, configureLog v1, cmakeFiles v1. Generated at configure time, no build needed. Codemodel gives per-target: type (EXECUTABLE, STATIC/SHARED/MODULE/OBJECT/INTERFACE_LIBRARY, UTILITY), sources with `isGenerated`, sourceGroups, compileGroups (language, includes with isSystem, defines, command fragments), link fragments, dependencies, artifacts, and a backtrace graph to CMakeLists locations. Multi-config generators get one entry per configuration. https://cmake.org/cmake/help/latest/manual/cmake-file-api.7.html
- The same page, as summarised, shows no exposure of `add_custom_command` COMMAND/OUTPUT/DEPENDS. So "generates" edges from custom commands cannot come from codemodel alone; `cmake --trace-expand --trace-format=json-v1` (file, line, cmd, args per call) can supply them: https://cmake.org/cmake/help/latest/manual/cmake.1.html . Note trace output records only the commands executed in this configure, so it already reflects conditionals (`if(WIN32)`) for the configured platform.
- `cmake --graphviz` is target-to-target only. Same manual page.

### Ninja, Bazel
- `ninja -t deps` needs a prior build (reads .ninja_deps); `-t inputs` since 1.11; `-t compdb`; `-t graph`. https://ninja-build.org/manual.html
- Bazel `query` "has no concept of configurations"; `cquery` resolves `select()`; `aquery` exposes actions. https://bazel.build/query/language . Relevant as the model for "target graph vs configured graph" distinction, not as a tool for Loupe's CMake target.

### Python and JS/TS
- grimp: static analysis through `ast`, no execution; cannot see `__import__`/importlib; line numbers retained; BSD-2, Rust extension. https://github.com/python-grimp/grimp . import-linter sits on top (contracts). https://import-linter.readthedocs.io/en/stable/
- dependency-cruiser: JS/TS/CoffeeScript, ES6, CJS, AMD, dynamic import; Acorn; MIT. https://github.com/sverweij/dependency-cruiser . madge: CJS/AMD/ES6 plus Sass/Stylus/Less; dot output. https://github.com/pahen/madge
- oxc-resolver: Rust port of enhanced-resolve and tsconfig-paths, with NAPI bindings and a WebAssembly target. https://github.com/oxc-project/oxc-resolver
- Loupe's GUI is plain JS/HTML in a webview; tree-sitter-javascript plus a tiny relative-path resolver is likely sufficient. Full Node resolution is probably unnecessary (UNVERIFIED about HORDE's actual JS shape).

### Polyglot extractors
- Emerge: regex-based parsing, 12 languages for file scanning; https://github.com/glato/emerge . depends: Eclipse CDT/ANTLR, typed dependencies, JVM; https://github.com/multilang-depends/depends . srcML: XML, five languages, GPL; https://www.srcml.org/ . ast-grep: tree-sitter structural search; https://github.com/ast-grep/ast-grep . Understand and Semgrep engine: not researched (fetch not attempted/UNVERIFIED).
- Doxygen: INCLUDE_GRAPH, INCLUDED_BY_GRAPH, CALL_GRAPH, GENERATE_XML work without Clang; CLANG_ASSISTED_PARSING is optional and improves accuracy; ENABLE_PREPROCESSING/PREDEFINED evaluate directives. https://www.doxygen.nl/manual/config.html . Precedent that a name-based, preprocessing-aware, non-compiler tool is accepted for include and call graphs.

### Hard problems (evidence)
- Conditional compilation: Linux 3.2 has 12,000+ features controlling 31,000 files with 89,000 #ifdef blocks; single-configuration compilers "see only parts of the code"; variability-aware parsers (TypeChef, SuperC) need heavy setup and cost. Source: search results at https://arxiv.org/pdf/2110.05828 , https://www.usenix.org/conference/atc14/technical-sessions/presentation/tartler , https://www.informatik.uni-marburg.de/~pgiarrusso/TypeChef/Thesis-TypeChef.pdf (secondhand summary; I did not read the papers).
- Generated code: scip-clang requires prior build for this reason (above). CMake marks sources `isGenerated`.
- Macros, function pointers, virtual dispatch, registries, FFI/webview bridges: no primary source obtained in this pass. UNVERIFIED as quantified claims; they are well-known in principle but I have no citation.
- Monorepo scale: not researched beyond scip-clang's own admission that it has no CI job indexing large projects.

## 3. A. Reuse

1. **CMake File API codemodel for target-to-sources, compile flags, includes, defines, language, isGenerated, per-target dependencies, and platform conditionals.** Do not parse CMakeLists for this. It needs the `cmake` binary and a configure step, not a build. Trade-off: a native-binary dependency on CMake, but CMake is already the project's own build tool and is not a native build of Loupe. It answers the "what does each build target compile" requirement, which compile_commands.json cannot (it has no targets; see C.5). It is also per-configuration, so Windows-only files appear only if configured for Windows (see C.4).
2. **`cmake --trace-expand --trace-format=json-v1`** for custom commands (generated-file edges) and for `add_custom_command` that codemodel omits. Deterministic JSON per configure. Strip absolute paths and timestamps (trace has timestamps) before hashing.
3. **Emit the graph in a form other tools can read, but keep Loupe's schema as primary.** SCIP is symbol-centric and (per the fetched summary) has no file-to-file typed edge or provenance-per-edge concept; an export to SCIP or dot is a later adapter, not the store. (UNVERIFIED that SCIP cannot express file edges; read the proto before deciding.)
4. **tree-sitter queries (tags-style) for syntactic facts**, using the community vocabulary `@definition.*` / `@reference.call` so queries are portable.
5. **Optional enrichment, clearly marked as a different provenance: clang-scan-deps** over the same compile database to compute actual include sets for the configured platform. Native LLVM binary; use only if present on PATH and record the tool version in the output; fall back to tree-sitter include extraction. This is the one place a native dependency buys real precision at low cost (preprocessor-only, no build). Verify flags first.
6. **Python: stdlib `ast`** (or tree-sitter-python) for imports. grimp is unnecessary for a mixed repo of generator scripts.
7. **JS: tree-sitter-javascript plus own relative-path resolver**; consider oxc-resolver WASM only if bare-specifier or tsconfig-paths resolution turns out to matter.

## 4. B. Avoid (documented dead ends)

- **stack-graphs**: archived 2025-09-09.
- **scip-clang / Kythe / CodeQL / clangd-indexer as required inputs**: need native toolchains and (scip-clang explicitly) a completed build including generated code; contradicts "no model, no native deps, deterministic from commit".
- **CodeQL on a possibly private repo**: licence bars CI use on non-open-source code without paid GHAS.
- **Ninja deps (`-t deps`)**: requires a prior build, and the user's machine uses Unix Makefiles with no Ninja (per global CLAUDE.md).
- **Regex-only extraction as the end state** (Emerge-style): acceptable as a baseline (the existing probe) but there is no precision story; keep it only as a fallback layer.
- **Full variability-aware parsing (TypeChef/SuperC)**: heavy setup, costly, still incomplete per the cited literature; out of scope for file-level graphs.
- **Treating `compile_commands.json` as the target list.** It is TUs only.
- **include-what-you-use**: wrong problem (lint), version-locked to Clang.

## 5. C. Contradictions

1. Evidence that tree-sitter's C/C++ grammars do not run a preprocessor and support #if in only four positions (https://github.com/tree-sitter/tree-sitter-c/issues/106 , https://doxide.indii.org/parsing/ ) suggests Loupe decision "tree-sitter extracts C/C++ structure" may be wrong in the macro-heavy regions, because ERROR nodes will appear around macros and conditional blocks. Expected loss: includes and defines survive (they are line-oriented directives); call extraction and symbol boundaries are the first thing to degrade. Mitigation: record per-file parse-error counts as evidence, never claim a call edge from a subtree containing ERROR. (The magnitude on HORDE is UNMEASURED; measure on the target.)
2. Evidence that the include graph is configuration-dependent (single-config compilers "see only parts of the code"; Linux numbers above) suggests Loupe decision "same commit + same config gives the one graph" may be wrong if "config" means one platform: files and includes under `#if _WIN32` / `if(WIN32)` exist in the repo but vanish in a macOS configure. The committed "see Windows-only files" goal is not satisfiable by codemodel alone on macOS. Needs a decision: union over platforms (crawl all `if` branches syntactically, tag edges with condition) or per-platform graphs, either of which must be explicit in the schema.
3. Evidence that resolving includes exactly requires include paths and defines (compile database or codemodel) and that clang-scan-deps does the preprocessor-only version natively suggests Loupe decision "no native deps AND correct for C++" may be wrong as stated: tree-sitter plus include-path search gives a good approximation for `#include` (paths are textual), but `#include MACRO` or computed includes and `__has_include` cannot be resolved without a preprocessor. Which of "no native deps" or "exact include graph" wins is a human call; I recommend approximation with a "searched, not resolved" marker (already in the design) and an optional clang-scan-deps cross-check.
4. Evidence that the CMake File API is per-configuration and does not expose custom commands (https://cmake.org/cmake/help/latest/manual/cmake-file-api.7.html , as summarised) suggests Loupe decision "detect generated and embedded files from CMake custom commands" may be wrong if it assumes codemodel provides them: it provides `isGenerated` on sources but not the generating command. The trace output or CMakeLists parsing is required.
5. Evidence that compile_commands.json has no target field and no header entries (https://clang.llvm.org/docs/JSONCompilationDatabase.html ) suggests Loupe decision "know which files each build target compiles from compile_commands.json" may be wrong, because the database lists TUs, not targets. (The task brief anticipated this; the fix is codemodel.) Headers also have no entries, so include paths for a header-only inspection must be borrowed from a TU that includes it.
6. Evidence that scip-clang requires a prior full build and Beta status, and that Joern's "fuzzy" approach exists specifically because builds are often unavailable (https://github.com/sourcegraph/scip-clang , https://docs.joern.io/ ), suggests Loupe decision "run in a target repo without requiring a build" is sound, but "later symbol-level calls" is the point where the no-build constraint will hurt most: call resolution for C++ (overloads, templates, virtuals) is where tree-sitter-by-name will be wrong. Plan symbol-level edges as `inferred`/name-matched provenance, not `static`, unless a compiler produced them.
7. Evidence of CodeQL's licence limits and that no mature open index (SCIP, Kythe, Glean) records typed file-level edges with provenance and "missing node" semantics suggests Loupe decision "own graph schema" is NOT redundant. This one supports the decision; reported for completeness. Caveat: I did not read the SCIP proto, so "no file-level edges" rests on a fetched summary that said the docs do not mention it.
8. Evidence that file-level include/call graphs are the established baseline (Doxygen INCLUDE_GRAPH/CALL_GRAPH, GNU Global GRTAGS, depends, Emerge) shows prior art does produce them, but also that all of them are name-based beyond includes. This suggests Loupe decision "file-level first" is reasonable, but "audio/parameter/modulation roles by signature" has no prior art in this lane and should be treated as new, unvalidated work.

## 6. D. Recommended extraction architecture for P1 (under 200 words)

Three deterministic layers, each edge tagged with its layer as provenance.
1. Build layer: run `cmake` configure with File API queries (codemodel, cmakeFiles, toolchains) and json-v1 trace into an out-of-tree dir; read target-to-sources, flags, include dirs, defines, `isGenerated`, custom-command outputs. Pin the generator and platform in config; record cmake version.
2. Syntax layer: web-tree-sitter (C, C++, Python, JS, shell grammars, wasm hashes pinned) extracts includes, defines, imports, string-literal bridge names, definitions, and call names. Resolve includes by the codemodel's per-source include dirs, falling back to search, marked "searched". Record ERROR-node counts per file; emit no call edge from an error subtree.
3. Inventory layer: git ls-files closure; missing nodes with reasons.
Sort all traversals, strip absolute paths and timestamps, canonical JSON, content hashes. Optional clang-scan-deps cross-check as a separate provenance, off by default.
Main risk: configuration dependence. One platform's configure hides Windows-only files and `#if` branches; the graph will silently under-report unless conditional edges are tagged and a union/per-platform policy is decided up front.

## 7. Sources (all fetched 2026-10-10; primary dates given only where seen)

- https://tree-sitter.github.io/tree-sitter/
- https://tree-sitter.github.io/tree-sitter/4-code-navigation.html
- https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web
- https://github.com/tree-sitter/tree-sitter-c , https://github.com/tree-sitter/tree-sitter-c/issues/106
- https://github.com/tree-sitter/tree-sitter-cpp , https://github.com/tree-sitter/tree-sitter-cpp/issues/293
- https://doxide.indii.org/parsing/
- https://github.com/github/stack-graphs (archived 2025-09-09)
- https://github.com/sourcegraph/scip ; https://github.com/sourcegraph/scip-clang ; https://sourcegraph.com/blog/announcing-scip (2022-06-08)
- https://github.com/google/kythe ; https://github.com/facebookincubator/Glean
- https://codeql.github.com/docs/codeql-overview/supported-languages-and-frameworks/ ; https://github.com/github/codeql-cli-binaries/blob/main/LICENSE.md
- https://docs.joern.io/
- https://clang.llvm.org/docs/JSONCompilationDatabase.html ; https://clangd.llvm.org/design/indexing
- https://lists.llvm.org/pipermail/cfe-dev/2018-November/060074.html (RFC, 2018-11) ; https://llvm.googlesource.com/clang/+/refs/heads/master/tools/clang-scan-deps/ClangScanDeps.cpp
- https://github.com/include-what-you-use/include-what-you-use
- https://cmake.org/cmake/help/latest/manual/cmake-file-api.7.html ; https://cmake.org/cmake/help/latest/manual/cmake.1.html
- https://ninja-build.org/manual.html ; https://bazel.build/query/language
- https://github.com/universal-ctags/ctags ; https://www.gnu.org/software/global/manual/global.html ; https://www.doxygen.nl/manual/config.html
- https://github.com/python-grimp/grimp ; https://import-linter.readthedocs.io/en/stable/
- https://github.com/sverweij/dependency-cruiser ; https://github.com/pahen/madge ; https://github.com/oxc-project/oxc-resolver
- https://github.com/glato/emerge ; https://github.com/multilang-depends/depends ; https://github.com/ast-grep/ast-grep ; https://www.srcml.org/
- Variability: https://arxiv.org/pdf/2110.05828 ; https://www.usenix.org/conference/atc14/technical-sessions/presentation/tartler ; https://www.informatik.uni-marburg.de/~pgiarrusso/TypeChef/Thesis-TypeChef.pdf (listed from search results, not read)

Not covered (no evidence gathered): Understand, Semgrep engine, LSIF spec, TypeScript compiler API, Kythe determinism, quantified macro/function-pointer/FFI precision loss, monorepo scale beyond one remark.
