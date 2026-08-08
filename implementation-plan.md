# Implementation Plan

## Strategic Revision

The project should no longer assume that the core COBOL static-analysis engine must be built from scratch in TypeScript.

New market and technical review found that `cobol-intel` appears to cover much of the static-analysis engine territory already: COBOL parsing, copybook resolution, call graphs, impact analysis, LLM explanation, and Mermaid-oriented output. The plan is therefore revised around an engine-adapter strategy:

`cobol-intel / fallback analyzer / future engines -> normalized analysis model -> SQLite -> System Map -> Ask AI -> Mermaid or XYFlow`

The product differentiation should be the accessible web experience:

`Open website -> paste GitHub URL or choose CardDemo -> analyze -> explore system visually -> Ask AI`

The current TypeScript analyzer remains useful, but primarily as a baseline, smoke test, fallback, and comparison target.

The long-term compounding value is likely not "owning a compiler." It is tolerant ingestion:

`messy real-world COBOL -> reliable Normalized IR with evidence, confidence, and coverage`

This product is a legacy comprehension utility, not a COBOL compiler. Partial analysis is acceptable and should be reported honestly.

One part of that asset is a tolerant COBOL normalization layer that strips or classifies real-world header/noise constructs while preserving original source locations for evidence.

## Current Project State

Steps 1 through 4 are already implemented as a baseline:

- Next.js 16 / React / TypeScript / Tailwind / shadcn/ui app scaffold
- CardDemo clone/cache strategy through `.cache/carddemo` or `CARDDEMO_SOURCE_DIR`
- file discovery and classification
- minimal TypeScript static analyzer for COBOL, Copybook, and JCL
- `npm run ingest` outputting `analysis-output/carddemo-analysis.json`

The next major step is defining the Normalized IR, provenance model, and coverage metrics.

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

### 6. Define Normalized IR, Provenance, And Coverage Metrics

Status: complete.

Design the internal analysis contract after the `cobol-intel` benchmark.

Normalized IR is the center of the product. The UI, Ask AI, Mermaid, XYFlow, and persistence layers should depend on this IR, not on any analyzer's native output.

The IR should normalize multiple possible engines:

- `cobol-intel`
- current TypeScript fallback analyzer
- future parser or commercial/OSS engines

Minimum normalized concepts:

- `Project`
- `SourceFile`
- `NormalizedEntity`
- `NormalizedRelation`
- `SourceLocation`
- `Evidence`
- `AnalysisRun`
- `AnalysisEngine`
- `AnalyzerFinding`
- `CoverageReport`
- `GraphVisualization`
- `AiExplanation`

Minimum entity types:

- `Program`
- `Paragraph`
- `Copybook`
- `Field`
- `Job`
- `Step`
- `Dataset`
- `Transaction`
- `Table`

Minimum relation types:

- `CALLS`
- `COPIES`
- `CONTAINS`
- `EXECUTES`
- `READS`
- `WRITES`
- `USES`
- `INVOKES`

Every relation should carry provenance:

- analyzer id and version;
- source location;
- evidence snippet;
- extraction rule or method;
- confidence score;
- confidence reason;
- unresolved or unsupported status where applicable.

Coverage metrics should be first-class:

- file coverage;
- entity coverage;
- relation coverage;
- evidence coverage;
- unresolved copybook/call/dataset counts;
- unsupported construct counts;
- confidence distribution;
- analyzer agreement/disagreement when more than one analyzer reports the same relation.

The adapter boundary should ensure that UI, Ask AI, Mermaid, XYFlow, and SQLite do not depend on any one engine's native output shape.

Result:

- `src/lib/analysis/normalized-ir.ts` defines the Zod-validated Normalized IR.
- `src/lib/analysis/baseline-adapter.ts` converts the TypeScript baseline analyzer output into Normalized IR.
- `npm run ingest` writes `analysis-output/carddemo-normalized-ir.json`.
- The first CardDemo normalized run produced 6124 entities, 8638 relations, 14762 evidence records, and 446 unresolved findings.

### 7. Measure CardDemo Baseline Coverage

Status: complete.

Before adding SQLite, measure how well the current TypeScript baseline analyzer covers CardDemo.

The benchmark should answer:

- How many files were discovered by kind?
- How many files produced at least one meaningful entity?
- How many files produced at least one meaningful relation?
- Which entity and relation types were extracted?
- What percentage of relations have source evidence?
- Which COPY statements, CALL targets, JCL program references, datasets, fields, and CICS/SQL constructs remain unresolved?
- Which unsupported or partially supported constructs appear most frequently?

The output should be a generated coverage report, for example:

```text
Analysis coverage: 87%

OK PROGRAM-ID
OK 14 COPY relationships
OK 7 CALL relationships
OK 3 datasets
WARN 2 unresolved dynamic calls
WARN unsupported EXEC CICS construct
WARN paragraph CFG incomplete
```

The goal is not to maximize strict parse success. The goal is to maximize useful, evidenced comprehension.

After this report exists, improve the baseline analyzer by frequency: address the most common unsupported or unresolved constructs first.

Result:

- `src/lib/analysis/coverage-report.ts` builds coverage metrics from Normalized IR.
- `scripts/report-carddemo-coverage.ts` writes coverage JSON and Markdown reports.
- `npm run coverage` generates `analysis-output/carddemo-coverage-report.json` and `analysis-output/carddemo-coverage-report.md`.
- First CardDemo baseline coverage: entity coverage 67.9%, relation coverage 65.8%, evidence coverage 100.0%, unresolved findings 446.
- Highest-impact next improvements are external/system copybooks, dynamic CICS transaction handling, DB2 table entity creation, runtime/library call classification, JCL utility program classification, and dataset/file entity creation.

### 8. Add Tolerant COBOL Normalization

Status: complete.

Before adding SQLite, add a source normalization layer used by the baseline analyzer.

The goal is not to compile COBOL. The goal is to produce extraction-safe text while preserving enough source mapping to prove every claim against the original source.

The normalizer should handle:

- fixed-format source columns;
- sequence numbers;
- indicator column comments and continuations;
- comment and license banners;
- identification/header paragraphs such as `AUTHOR`, `INSTALLATION`, `DATE-WRITTEN`, `DATE-COMPILED`, and `SECURITY`;
- `CONFIGURATION SECTION` and other structural lines that are useful as skeleton information but should not block partial extraction;
- source line mapping from normalized lines back to original source lines.

Outputs should include:

- normalized lines;
- original line mapping;
- removed or classified header/noise blocks;
- normalization metrics;
- unsupported or partially supported constructs.

Coverage should report:

- header lines stripped;
- comment lines stripped;
- continuation lines joined;
- normalized line count;
- extraction-safe line count;
- unsupported header/structure constructs.

Result:

- `src/lib/analysis/cobol-normalizer.ts` normalizes COBOL source while preserving original line mapping.
- The baseline COBOL analyzer now extracts from normalized text while evidence still points to original source lines.
- Normalization metrics are included in the Normalized IR coverage report.
- First CardDemo normalization run covered 45 COBOL files, 30595 original lines, 23130 normalized lines, 3470 removed comment lines, 3932 removed blank/empty lines, 52 stripped header lines, and 11 joined continuation lines.
- The normalization pass reduced unresolved findings from 446 to 444 by removing noise before extraction.

### 9. Add SQLite Persistence

Status: complete.

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
- `coverage_reports`
- `ai_explanations`

Use JSON metadata columns where helpful, but keep entity and dependency types explicit enough for graph queries.

Result:

- `drizzle-orm` and `better-sqlite3` are installed for local SQLite persistence.
- `src/lib/db/schema.ts` defines the query-facing SQLite/Drizzle table schema.
- `src/lib/db/bootstrap.ts` creates the SQLite tables and indexes without requiring a migration generator.
- `src/lib/db/client.ts` opens SQLite with foreign keys and WAL mode enabled.
- `scripts/persist-carddemo-analysis.ts` persists `analysis-output/carddemo-normalized-ir.json` into `analysis-output/carddemo.sqlite`.
- `npm run persist` is the local persistence command.

### 10. Persist Entities, Dependencies, Evidence, And Coverage

Status: complete.

Normalize extracted analysis into entities, relations, evidence records, analyzer findings, and coverage reports.

Initial entity types:

- COBOL Program
- Paragraph
- Copybook
- Field
- JCL Job
- JCL Step
- Dataset/Data File
- CICS Transaction
- DB2 Table when statically verified

Initial dependency types:

- `CALLS`
- `COPIES`
- `CONTAINS`
- `EXECUTES`
- `READS`
- `WRITES`
- `USES`
- `INVOKES`

Do not create relationships that are not backed by static evidence.

Analyzer disagreement should not be hidden. When multiple analyzers disagree, lower confidence or mark the finding for review instead of silently choosing one.

Current result:

- The persistence path writes normalized entities, relations, evidence, provenance, analyzer findings, and the coverage report into SQLite.
- `source_files` are currently inferred from entity, evidence, and finding source paths. Later GitHub URL ingestion should persist full discovered file inventory, including unknown files with no extracted entities.
- The physical table is named `relations` to match the Normalized IR. It fills the dependency role described in this step.

### 11. Build SQLite Query Layer

Status: complete.

Build deterministic query functions over the persisted SQLite model before adding AI or broad visualization.

Initial query functions:

- `getLatestAnalysisRun`
- `getAnalysisQuality`
- `searchEntities`
- `getEntity`
- `getNeighborhood`
- `getRelationEvidence`
- `getSource`

The query layer is the product boundary between persistence and UI. System Map and Ask AI should both use these deterministic queries instead of reading raw database tables directly.

Current result:

- `src/lib/db/analysis-queries.ts` exposes the latest run, quality summary, entity search, neighborhood, relation evidence, and source-line lookup boundary.
- Query options support bounded hop traversal plus node type, relation type, and confidence filters.
- Source evidence is resolved from persisted source roots and original line ranges when the source file is available.

### 12. Build Analysis Quality Dashboard

Status: complete.

Expose analysis confidence and known gaps to the user, not only to internal benchmarks.

The dashboard should show:

- files analyzed and files discovered;
- entity, relation, and evidence coverage;
- unresolved copybook, call, CICS target, runtime call, dataset, and unsupported construct counts;
- confidence distribution;
- analyzer agreement and disagreement when multiple analyzers exist;
- analyzer version and run timestamp.

The product voice should be:

`We verified this much. These areas remain unresolved or partial.`

This is a trust feature. The UI should avoid implying perfect comprehension of an enterprise legacy system.

Current result:

- The dashboard shows file, entity, relation, and evidence coverage.
- It shows unresolved findings by category, unsupported findings, confidence score, entity/relation/evidence counts, analyzer name/version, and run timestamp.

### 13. Build Search-First System Map And Source Viewer

Status: complete.

Use `@xyflow/react` for the System Map.

Do not render the full graph at startup. A CardDemo run already has thousands of relations, and the enterprise case will be larger. The intended user journey is:

`Search -> Entity -> Neighborhood -> Follow relation -> Source`

Initial graph features:

- zoom, pan, fit view
- search
- node type filter
- edge type filter
- selected-node inspector
- 1-hop, 2-hop, and 3-hop neighborhood loading
- upstream/downstream highlighting
- node and edge limits for readability
- unresolved targets styled differently
- confidence/status filters

Build a lightweight read-only Source Viewer:

- show source file text;
- jump to entity/evidence line ranges;
- highlight selected lines;
- link graph nodes and evidence references to source locations.

Current result:

- The first UI pass reads SQLite directly through `src/lib/db/analysis-queries.ts`.
- The home screen now includes Analysis Quality, entity search, 1-hop/2-hop/3-hop neighborhood controls, an XYFlow System Map, and relation evidence snippets.
- The graph intentionally defaults to a search result and bounded neighborhood instead of rendering all relations.
- Node type, relation type, and confidence filters are available from the UI.
- Relation follow links let users move from the selected entity to another verified target entity.
- Source evidence displays original line numbers and source context when the configured source root is available; unavailable source files retain the persisted evidence snippet.
- `npm run lint`, `npm run build`, and an HTTP smoke check against the running app pass.

### 14. Build Ask AI With Verified Visual Answers

Status: complete.

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

Current result:

- `src/app/api/ask/route.ts` exposes a bounded server-side Ask AI endpoint.
- `src/lib/ai/ask.ts` resolves an entity, loads its verified neighborhood and evidence, and builds a constrained context package before any LLM call.
- `src/components/ask-ai-panel.tsx` provides the Ask AI experience alongside the System Map.
- Vertex AI service-account authentication enables Gemini explanation; model selection uses `VERTEX_AI_MODEL_ID` and otherwise defaults to the currently supported GA model `gemini-3.6-flash`. Without valid Google credentials/project configuration, or when the call fails, the product returns a deterministic verified summary.
- Responses disclose whether they came from Gemini or the deterministic fallback and include source evidence locations.
- The LLM prompt explicitly forbids inventing entities, relations, source lines, or behavior.

### 15. Add GitHub URL Based Ingestion UX

Status: in progress.

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

Current result:

- The home screen now clearly separates `Public repo = Free`, `Private repo = Contact us`, and `Source cannot leave company = Contact us`.
- `src/app/api/ingest/route.ts` validates public GitHub repository URLs, fetches public repositories, and returns an explicit contact branch for private or source-restricted requests.
- `src/components/repository-ingestion-panel.tsx` makes source handling and the no-code-execution policy visible before ingestion.
- `src/lib/ingestion/github-fetcher.ts` resolves HEAD with `git ls-remote`, performs a depth-one detached clone, applies file/size limits, ignores `.git`, `node_modules`, and symbolic links, and returns a repository manifest.
- `src/lib/ingestion/analyze-source.ts` reuses the existing discovery, baseline analyzer, Normalized IR adapter, and SQLite persistence pipeline for a fetched source root.
- `src/lib/ingestion/github-url.ts` and `src/lib/ingestion/limits.ts` define the accepted URL shape and safety limits.
- The fetch layer has been smoke-tested against a public GitHub repository and recorded its commit SHA and file manifest.
- The public ingestion endpoint now completes fetch, analysis, Normalized IR creation, and SQLite persistence in one PoC request. Progress events/worker isolation and retention cleanup remain for the production hardening slice.
- AWS deployment preparation remains independent of the existing lawvot nginx repository and ECR. `.fordeploy/deploy-aws.sh` uses manual Docker save/scp/load deployment with host port `3300`, and `.fordeploy/configure-aws-alb.sh` connects a dedicated `cobolai` target group to `cobolai.penvot.com`.

AWS deployment decisions:

- The LawVot production path is the reference: WSL PEM -> Bastion -> the existing `t3a` SSH alias -> the private instance. This repository does not use the LawVot nginx repository.
- The first `.fordeploy/deploy-aws.sh` run builds the image locally, saves it as a tar archive, transfers it into `/home/hchjeong/docker_images/legacy-lang-intelligence/images`, loads it, and replaces only the `cobolai` container. ECR is intentionally not used.
- The deployment script invokes `.fordeploy/configure-aws-alb.sh` automatically. That script creates or updates the dedicated target group, registers the `t3a.medium` instance on host port `3300`, allows only the ALB security group to reach port `3300`, creates the `cobolai.penvot.com` and `physicalai.penvot.com` host rules, and removes the retired `ai.sampoongapt.com` rule.
- Runtime credentials follow the LawVot AWS image pattern. `.env.local` and `gcp-key.json` are Git-ignored, are restored from `.fordeploy/aws-backup` or configured absolute source paths before `docker build`, and are copied into the image as `/app/.env.local` and `/app/gcp-key.json`. Temporary root copies are restored or removed after the build.
- Vertex AI uses `GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-key.json`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and `VERTEX_AI_MODEL_ID`. No `GEMINI_API_KEY`, `GEMINI_MODEL`, or LawVot-specific model variable is required. The code fallback is `gemini-3.6-flash`.
- The application container uses internal port `3000` and host port `3300` so it does not collide with existing services. No nginx configuration is changed by this repository.

### 16. Production Ingestion Hardening And Localization

Status: in progress.

Next operational work:

- persist ingestion run state (`queued`, `fetching`, `analyzing`, `persisting`, `completed`, `failed`, `cancelled`);
- return a run id immediately and move fetch/analysis into a worker;
- add progress polling, timeout, cancellation, concurrency limits, duplicate commit reuse, and retention cleanup;
- record source URL, commit SHA, manifest, errors, and timestamps independently from the analysis run;
- test public, invalid, oversized, timeout, failed clone, and no-analyzable-file cases.

Operational progress:

- `ingestion_runs` persists phase, status, progress, source URL, commit SHA, manifest, timestamps, and error text.
- `POST /api/ingest` updates the run through fetch, analyze, and persist phases.
- `GET /api/ingest/status?runId=...` exposes the current status for a future progress UI.
- A `t3a.medium` is the recommended initial host when the existing `t3a.small` already runs two containers: both have 2 vCPUs, but medium provides 4 GiB versus small's 2 GiB. Keep ingestion concurrency at one until CloudWatch memory/CPU/credit metrics justify a larger or separate worker host.

Remaining AWS operations:

- confirm that the ALB HTTPS certificate contains `cobolai.penvot.com` and `physicalai.penvot.com` or `*.penvot.com`;
- run the first deployment through the existing `t3a` SSH alias and verify the `cobolai` container health check on `/en`;
- verify the ALB target is healthy and the two host rules route to the intended target groups;
- verify the Vertex service account has Vertex AI User permission in `GOOGLE_CLOUD_PROJECT`;
- verify CloudWatch memory, CPU, disk, and restart behavior after the first deployment;
- add a rollback command that reloads the previous image tar or tag without touching other containers.

Localization result:

- `/en` is the default English route and `/ko` is the Korean route.
- Both routes share the same server-rendered TSX and typed dictionary in `src/lib/i18n.ts`.
- Language switching preserves search, selected entity, hop, node type, relation type, and confidence query state.
- API routes remain locale-neutral under `/api`.

Test plan after the current implementation:

- unit tests for URL parsing, repository limits, confidence and status mapping;
- integration tests for public GitHub fetch, commit pinning, analysis persistence, and API contact branches;
- route smoke tests for `/en` and `/ko`, including query-state-preserving language switching;
- UI tests for Analysis Quality, System Map filters, Ask AI fallback, and Source Evidence;
- security tests proving repository code is never executed and symlinks/ignored directories are skipped;
- production deployment test on the AWS private instance through the existing shell deployment path.

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
