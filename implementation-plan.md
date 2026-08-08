# Implementation Plan

## Strategic Revision

The project should no longer assume that the core COBOL static-analysis engine must be built from scratch in TypeScript.

New market and technical review found that `cobol-intel` appears to cover much of the static-analysis engine territory already: COBOL parsing, copybook resolution, call graphs, impact analysis, LLM explanation, and Mermaid-oriented output. The plan is therefore revised around an engine-adapter strategy:

`cobol-intel / fallback analyzer / future engines -> normalized analysis model -> SQLite -> System Map -> Ask AI -> Mermaid or XYFlow`

The product differentiation should be the accessible web experience:

`Open website -> paste GitHub URL or choose CardDemo -> analyze -> explore system visually -> Ask AI`

The current TypeScript analyzer remains useful, but primarily as a baseline, smoke test, fallback, and comparison target.

## Current Project State

Steps 1 through 4 are already implemented as a baseline:

- Next.js 16 / React / TypeScript / Tailwind / shadcn/ui app scaffold
- CardDemo clone/cache strategy through `.cache/carddemo` or `CARDDEMO_SOURCE_DIR`
- file discovery and classification
- minimal TypeScript static analyzer for COBOL, Copybook, and JCL
- `npm run ingest` outputting `analysis-output/carddemo-analysis.json`

The next major step is `cobol-intel` benchmark and integration planning.

## Revised MVP Steps

### 1. Initialize The Web App

Status: complete.

Create a TypeScript web app using the current stable Next.js and React stack.

Initial requirements:

- TypeScript strict mode
- Tailwind CSS
- shadcn/ui-compatible structure
- Lucide icons
- basic app shell with System Map, Ask AI, and Source views
- scripts suitable for local development, private AWS instance deployment, and Docker deployment

### 2. Build CardDemo Fixture / Clone Strategy

Status: complete.

Do not blindly copy the full AWS CardDemo repository into this project.

Use a controlled ingestion source strategy:

- clone or fetch CardDemo into a cache/fixture location outside committed app code;
- record upstream repository URL and license in project documentation;
- allow the ingestion path to be configured by environment variable or CLI option;
- support rerunning ingestion from a clean checkout.

### 3. Implement File Discovery And Classification

Status: complete.

The ingestion script should:

- walk the configured CardDemo source path;
- classify files using path, extension, naming convention, and content hints;
- identify COBOL, Copybook, JCL, documentation, data/config, and unknown files;
- retain file checksums and source paths for later persistence.

Classification should be conservative. Unknown files should be stored but not overinterpreted.

### 4. Implement Minimal Static Analysis Baseline

Status: complete.

The current TypeScript analyzer is a baseline and fallback, not the presumed final engine.

It should remain able to extract:

- `PROGRAM-ID`
- `CALL`
- `COPY`
- `EXEC CICS`
- `EXEC SQL`
- basic file declarations and file references
- Copybook field hierarchy where safely detectable
- JCL `JOB`, `EXEC`, `DD`, dataset references, and execution order

Each extracted relationship should include source evidence and a confidence value.

### 5. Benchmark `cobol-intel`

Status: complete.

Before designing the final persistence schema, evaluate `cobol-intel` directly against CardDemo.

Questions to answer:

- Can it analyze the CardDemo repository without manual source restructuring?
- What commands, library APIs, or REST APIs are available?
- Can it emit stable JSON or another machine-readable output?
- Does it provide program, copybook, field, call graph, JCL, CFG, data-flow, impact, and source-location data?
- Does it resolve copybooks better than the current baseline analyzer?
- What evidence model does it expose for claims and dependencies?
- How usable are its Mermaid outputs, and can they be converted to the shared graph model?
- What dependencies are required, including Python, Java, ANTLR, model runtimes, and optional LLM providers?
- Is the package and repository license actually MIT and compatible with this project?
- How does performance look on CardDemo?

Deliverable:

- a short benchmark note in `docs/cobol-intel-benchmark.md`;
- a captured sample output under an ignored local analysis path or a small committed redacted fixture if appropriate;
- a recommendation: adopt as primary engine, use as optional engine, or reject.

Result:

`cobol-intel==0.3.1` is installable and promising on simple COBOL, but it failed all CardDemo COBOL files tested. Treat it as an optional research/benchmark engine for now, not the primary engine. See `docs/cobol-intel-benchmark.md`.

### 6. Define The Analysis Adapter And Normalized Schema

Status: next.

Design the internal analysis contract after the `cobol-intel` benchmark.

The schema should normalize multiple possible engines:

- `cobol-intel`
- current TypeScript fallback analyzer
- future parser or commercial/OSS engines

Core normalized concepts:

- `Project`
- `SourceFile`
- `Entity`
- `Dependency`
- `SourceLocation`
- `Evidence`
- `AnalysisRun`
- `AnalysisEngine`
- `GraphVisualization`
- `AiExplanation`

The adapter boundary should ensure that UI, Ask AI, Mermaid, and XYFlow do not depend on any one engine's native output shape.

### 7. Add SQLite Persistence

Status: pending.

Add SQLite with Drizzle ORM after the normalized analysis contract is defined.

Minimum tables:

- `projects`
- `analysis_runs`
- `analysis_engines`
- `source_files`
- `entities`
- `dependencies`
- `source_locations`
- `evidence`
- `ai_explanations`

Use JSON metadata columns where helpful, but keep entity and dependency types explicit enough for graph queries.

### 8. Persist Entities, Dependencies, And Evidence

Status: pending.

Normalize extracted analysis into entities, dependencies, and evidence records.

Initial entity types:

- COBOL Program
- Copybook
- Field
- JCL Job
- JCL Step
- Dataset/Data File
- CICS Transaction
- DB2 Table when statically verified

Initial dependency types:

- `CALLS`
- `INCLUDES_COPYBOOK`
- `CONTAINS_FIELD`
- `EXECUTES`
- `READS`
- `WRITES`
- `USES_TABLE`
- `USES_FILE`
- `INVOKES_PROGRAM`

Do not create relationships that are not backed by static evidence.

### 9. Build System Map And Source Viewer

Status: pending.

Use `@xyflow/react` for the System Map.

Initial graph features:

- zoom, pan, fit view
- search
- node type filter
- edge type filter
- selected-node inspector
- 1-hop, 2-hop, and 3-hop neighborhood loading
- upstream/downstream highlighting

Build a lightweight read-only Source Viewer:

- show source file text;
- jump to entity/evidence line ranges;
- highlight selected lines;
- link graph nodes and evidence references to source locations.

### 10. Build Ask AI With Verified Visual Answers

Status: pending.

Ask AI should route user questions through deterministic graph/source tools before calling Gemini.

Initial server-side tool/query layer:

- `searchEntities`
- `getEntity`
- `getSource`
- `findReferences`
- `getDependencies`
- `getUpstream`
- `getDownstream`
- `getImpactPaths`
- `getProgramsUsingCopybook`
- `getJobsExecutingProgram`
- `getFieldUsages`

Answer flow:

1. detect language and intent;
2. resolve relevant entities;
3. run deterministic graph/source queries;
4. build evidence package;
5. build a verified `GraphVisualization` model when useful;
6. ask Gemini to explain the verified result;
7. render text, evidence, and either Mermaid or `@xyflow/react` graph.

The LLM must not generate factual graph edges. It may only explain verified graph data.

### 11. Add GitHub URL Based Ingestion UX

Status: pending.

This is the major product differentiator.

The user should be able to:

- paste a public GitHub repository URL;
- trigger analysis;
- see progress and failures clearly;
- inspect discovered COBOL/JCL/Copybook assets;
- open the generated System Map;
- ask AI about the unfamiliar codebase.

Security and operational constraints:

- never execute repository code;
- enforce repository size and file count limits;
- clone into isolated, ignored, or disposable workspace paths;
- expose safe error messages;
- record source URL and commit SHA for each analysis run.

## Deployment Strategy

Docker deployment is compatible with the adapter-first strategy and is recommended for reproducibility.

Start with one container for the PoC:

- Next.js app
- Python runtime and virtual environment
- optional `cobol-intel`
- local SQLite database
- analysis cache volume

Split into `web` and `analysis` containers later if analysis becomes slow, stateful, or operationally noisy.

Do not port `cobol-intel` wholesale to Node unless a later benchmark proves that CLI/API wrapping is not viable.

## Deferred Until After MVP

- full TypeScript COBOL engine rewrite;
- vector search;
- broad business flow reconstruction;
- Monaco Editor;
- advanced AI tool calling if simple server-side routing is enough;
- automatic DB2/VSAM inference beyond statically verified evidence;
- multi-container worker queue unless analysis latency requires it.
