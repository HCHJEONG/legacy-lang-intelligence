# Implementation Plan

## Feasibility Summary

The MVP is feasible in this repository because the folder is currently empty and can be initialized as a new web application without migration constraints.

The full original scope is large, so the first implementation should prioritize a thin but end-to-end path:

CardDemo discovery -> deterministic entity/dependency extraction -> SQLite persistence -> System Map -> Source Viewer -> Ask AI answer with evidence and verified visualization.

## MVP Steps

### 1. Initialize The Web App

Create a new TypeScript web app using the current stable Next.js and React stack.

Initial requirements:

- TypeScript strict mode
- Tailwind CSS
- shadcn/ui-compatible structure
- Lucide icons
- basic app shell with System Map, Ask AI, and Source views
- scripts suitable for local development and private AWS instance deployment

Before implementation, verify current official package/API recommendations where version-sensitive.

### 2. Add Persistence And Schema

Add SQLite with Drizzle ORM.

Minimum tables:

- `projects`
- `source_files`
- `entities`
- `dependencies`
- `source_locations`
- `analysis_runs`
- `ai_explanations`

Use JSON metadata columns where helpful, but keep entity and dependency types explicit enough for graph queries.

### 3. Build CardDemo Fixture / Clone Strategy

Do not blindly copy the full AWS CardDemo repository into this project.

Implement a controlled ingestion source strategy:

- clone or fetch CardDemo into a cache/fixture location outside committed app code;
- record upstream repository URL and license in project documentation;
- allow the ingestion path to be configured by environment variable or CLI option;
- support rerunning ingestion from a clean checkout.

### 4. Implement File Discovery And Classification

Build `npm run ingest` around a script such as `scripts/ingest-carddemo.ts`.

The script should:

- walk the configured CardDemo source path;
- classify files using path, extension, naming convention, and content hints;
- identify COBOL, Copybook, JCL, documentation, data/config, and unknown files;
- persist discovered files with checksums and source paths.

Classification should be conservative. Unknown files should be stored but not overinterpreted.

### 5. Implement Minimal Static Analysis

Start with deterministic extraction instead of full compiler-grade parsing.

COBOL extraction:

- `PROGRAM-ID`
- divisions/sections/paragraphs where straightforward
- `CALL`
- `COPY`
- `EXEC CICS`
- `EXEC SQL`
- file declarations and basic file operations where detectable

Copybook extraction:

- copybook entity
- field hierarchy where line structure is clear
- basic `REDEFINES` and `OCCURS` metadata when safely detectable

JCL extraction:

- `JOB`
- steps
- `EXEC PGM`
- `PROC`
- `DD`
- dataset references
- execution order

Each extracted relationship must include source evidence and a confidence value.

### 6. Persist Entities, Dependencies, And Evidence

Normalize extracted analysis into entities and dependencies.

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

### 7. Build System Map And Source Viewer

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

### 8. Build Ask AI With Verified Visual Answers

Ask AI should route user questions through deterministic tools before calling Gemini.

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

Visualization selection:

- text only for short definitions;
- Mermaid for compact flow or sequence explanations;
- `@xyflow/react` for impact analysis and exploratory dependency graphs.

The LLM must not generate factual graph edges. It may only explain verified graph data.

## Deferred Until After MVP

- full COBOL grammar integration;
- vector search;
- broad business flow reconstruction;
- Monaco Editor;
- advanced AI tool calling if simple server-side routing is enough;
- automatic DB2/VSAM inference beyond statically verified evidence.

