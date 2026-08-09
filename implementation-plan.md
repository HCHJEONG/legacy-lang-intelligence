# Implementation Plan

## Strategic Revision

The project should no longer assume that the core COBOL static-analysis engine must be built from scratch in TypeScript.

New market and technical review found that existing engines may cover parts of the static-analysis territory already. The plan is therefore revised around an engine-adapter strategy:

`cobol-intel / COBOL-REKT / fallback analyzer / future engines -> normalized analysis model -> SQLite -> System Map -> Ask AI -> Mermaid or XYFlow`

The product differentiation should be the accessible web experience:

`Open website -> paste GitHub URL or choose CardDemo -> analyze -> explore system visually -> Ask AI`

The current TypeScript analyzer remains useful, but primarily as a baseline, smoke test, fallback, and comparison target.

The long-term compounding value is likely not "owning a compiler." It is tolerant ingestion:

`messy real-world COBOL -> reliable Normalized IR with evidence, confidence, and coverage`

This product is a legacy comprehension utility, not a COBOL compiler. Partial analysis is acceptable and should be reported honestly.

One part of that asset is a tolerant COBOL normalization layer that strips or classifies real-world header/noise constructs while preserving original source locations for evidence.

## Product, Technical, And Business North Star

The product should align three mutually reinforcing strategies.

**Product:** Build a free, global, English-first COBOL comprehension utility that helps developers understand unfamiliar legacy systems without first knowing program, copybook, job, dataset, or table identifiers.

**Technical:** Accept multiple analyzers through tolerant ingestion and engine adapters, normalize their verified and partial findings into a shared IR, and persist an evidence-backed graph. Product UI and Ask AI must depend on Normalized IR and deterministic queries rather than on any analyzer-native schema.

**Business:** Offer public-repository analysis for free to validate real demand and encounter diverse, legitimate edge cases. Use the resulting aggregate product signals to improve ingestion and coverage, then validate willingness to pay for private-repository connectivity, local operation, private-cloud/VPC deployment, on-premise deployment, and enterprise support.

The concise positioning is:

> A free, evidence-backed COBOL comprehension utility that learns from public-repository usage patterns and validates demand for private deployment.

The business validation funnel is:

`Free public repository analysis -> real usage and aggregate edge cases -> better coverage and trust -> private/local/on-premise demand validation -> paid deployment and support`

Free and paid editions should not intentionally differ in factual analysis quality. Paid value should come primarily from data isolation, private source connectivity, deployment control, governance, operational support, and organization-specific analyzer adapters.

Default telemetry must never collect repository source text, source snippets, credentials, or private repository contents. Without explicit opt-in, collect only anonymous or aggregate signals such as analysis success/failure, discovered file counts, unsupported and unresolved construct categories, feature and Ask AI intent usage, graph usage, and analysis duration. Public availability of a repository does not remove the need for a documented cache, retention, deletion, and telemetry policy.

Commercial hypotheses should be validated incrementally:

- public GitHub repository analysis: free product and learning surface;
- private repository SaaS connectivity: validate demand before implementation;
- local CLI or desktop operation: validate willingness to pay for code-local analysis;
- private AWS/VPC deployment: paid deployment and operational support candidate;
- on-premise deployment: paid license, installation, updates, and support candidate;
- enterprise offering: security review, governance, custom adapters, updates, and support.

The north-star success question is:

> Can developers obtain trustworthy understanding from public COBOL systems, and does that trust create demonstrated demand for the same experience where source code must remain private?

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

#### Follow-Up Engine Benchmark: COBOL-REKT

Status: planned.

[COBOL-REKT](https://github.com/avishek-sen-gupta/cobol-rekt) is an MIT-licensed reverse-engineering toolkit designed to be embedded in custom analysis workflows rather than consumed only as a standalone UI. Its documented capabilities include an Eclipse Che4z-based parse tree, AST and control-flow models, JSON and GraphML export, Data Division structure extraction, data dependency relations, inter-program dependencies, and an AWS CardDemo execution path.

Evaluate it as an additional engine-adapter candidate, not as an immediate replacement for the TypeScript fallback or as a reason to replace the product's Normalized IR.

Benchmark questions:

- Can a pinned COBOL-REKT commit build reproducibly in the local and Docker/AWS environments, including its Git submodules?
- Can its CLI or Java API analyze the unmodified CardDemo source and copybooks with the correct dialect configuration?
- Which CardDemo files parse successfully, partially, or fail, and why?
- Can JSON, GraphML, or Java API output be consumed without deploying Neo4j?
- Are identifiers and source locations stable enough to preserve evidence and compare repeated runs?
- How well does it extract programs, sections, paragraphs, calls, copybooks, Data Division layouts, records, fields, `REDEFINES`, and inter-program dependencies?
- How useful are its `ACCESSES`, `MODIFIES`, and `FLOWS_INTO`-style results for field-level lineage and impact analysis?
- Does it expose or enable verified COBOL file operations, JCL DD/dataset resolution, VSAM organization, and embedded DB2 table access, or are separate adapters still required?
- What are the runtime, memory, build-time, Java, Graphviz, and optional service dependencies for the subset of capabilities this product needs?
- Which features require Neo4j, Azure OpenAI, interpretation, or dynamic execution and should remain outside the static-ingestion path?
- How do its normalized results agree or disagree with the TypeScript fallback and `cobol-intel` on entities, relations, evidence, and unresolved findings?

Benchmark deliverables:

- `docs/cobol-rekt-benchmark.md` with the pinned repository commit, license verification, build steps, selected modules/tasks, and reproducible CardDemo commands;
- captured machine-readable sample output under an ignored analysis path, plus a small redacted fixture only when needed for automated adapter tests;
- a mapping table from COBOL-REKT concepts and relations to the product's Normalized IR;
- CardDemo comparison metrics for parse coverage, meaningful entities, meaningful relations, evidence coverage, data-layout coverage, field-lineage coverage, unresolved constructs, runtime, and memory;
- a recommendation to adopt it as a primary engine, use it as a specialized data/control-flow engine, keep it optional, or reject it.

Preferred integration if the benchmark succeeds:

`COBOL-REKT Java CLI/library -> COBOL-REKT adapter -> Normalized IR -> SQLite -> deterministic queries -> UI and Ask AI`

Start with the smallest useful, deterministic export surface. Do not ingest COBOL-REKT's Neo4j schema directly into the UI or replace SQLite merely because Neo4j-backed features exist. Do not enable its interpreter or LLM-assisted features in repository ingestion unless a later, separately scoped requirement justifies executing those modes.

### 6. Define Normalized IR, Provenance, And Coverage Metrics

Status: complete.

Design the internal analysis contract after the `cobol-intel` benchmark.

Normalized IR is the center of the product. The UI, Ask AI, Mermaid, XYFlow, and persistence layers should depend on this IR, not on any analyzer's native output.

The IR should normalize multiple possible engines:

- `cobol-intel`
- COBOL-REKT through a pinned Java CLI/library adapter if its CardDemo benchmark succeeds
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
- GitHub analyses now use stable repository-specific project ids (`github:owner/repository`) instead of being stored as CardDemo.
- The UI selects the latest non-empty analysis run per project, defaults to CardDemo when available, and exposes a project selector when multiple valid projects exist.
- Analyses with no extracted COBOL, Copybook, or JCL entities fail without replacing the currently visible project result.
- AWS deployment preparation remains independent of the existing lawvot nginx repository and ECR. `.fordeploy/deploy-aws.sh` uses manual Docker save/scp/load deployment with host port `3300`, and `.fordeploy/configure-aws-alb.sh` connects a dedicated `cobolai` target group to `cobolai.penvot.com`.

AWS deployment decisions:

- The LawVot production path is the reference: WSL PEM -> Bastion -> the existing `t3a` SSH alias -> the private instance. This repository does not use the LawVot nginx repository.
- The first `.fordeploy/deploy-aws.sh` run builds the image locally, saves it as a tar archive, transfers it into `/home/hchjeong/docker_images/legacy-lang-intelligence/images`, loads it, and replaces only the `cobolai` container. ECR is intentionally not used.
- ALB and Route 53 are manually configured. Deployments default to `CONFIGURE_ALB=0`; `.fordeploy/configure-aws-alb.sh` is retained for explicit administrative use only.
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

Confirmed defect-remediation backlog:

- **P1: make persisted analysis identifiers project/run scoped.** Entity, relation, evidence, provenance, finding, coverage, and source-file primary keys must not collide when the same repository is analyzed again or when different repositories contain matching qualified names or relative paths. Re-analysis should replace or retain prior project runs atomically, and integration coverage must exercise both repeated ingestion and overlapping names across projects.
- **P1: enforce ingestion limits before and during analysis.** Oversized files must count toward the repository byte limit even when they are excluded from analysis, and the discovery/analyzer path must never read a file exceeding `maxFileBytes`. Include clone workspace usage in operational safeguards, reject over-limit input before expensive analysis where possible, and clean successful ingestion workspaces according to a documented retention policy.
- **P1: persist runtime analysis data across container replacement.** Mount `analysis-output` or the SQLite database on an explicit host path or named volume so that `docker rm` and redeployment do not discard user-ingested projects. Document backup, restore, permissions, WAL companion-file handling, and rollback behavior.
- **P2: correct bidirectional multi-hop graph traversal and Ask AI directionality.** Incoming relations must expand their source entity while outgoing relations expand their target entity, with visited-node handling that prevents cycles. Ask AI must distinguish upstream sources from downstream targets instead of describing every edge through `edge.target`. Add tests for incoming, outgoing, cyclic, and mixed 1-hop/2-hop/3-hop neighborhoods.
- **P2: make System Map entity-type and confidence filters submit and persist correctly.** Place filter controls in the submitted form or add an explicit change/submit path, preserve all active filters in search, hop, project, and relation-follow links, and cover the resulting query state with UI tests.
- **P2: make ingestion status observable while work is running.** `POST /api/ingest` should validate the request, persist a queued run, and return its run id immediately. Fetch, analysis, and persistence should run in a bounded worker so the client can poll status, display real progress, cancel work, and recover from request or process restarts.

Remaining AWS operations:

- keep the existing Route 53 and ALB host rules unchanged and verify the `cobolai` target remains healthy on `/en` after each deployment;
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

Regression coverage now includes project-isolated run selection and protection against a newer empty run hiding the last valid CardDemo analysis.

### 17. Deliver The Product UX Improvement In Three Stages

Status: planned.

The next product iteration should move the application from an analyzer-oriented technical dashboard to a developer-oriented legacy comprehension utility. The primary product promise is:

> Help developers understand unfamiliar COBOL systems faster.

The target journey is:

`Question -> explanation -> verified visualization -> dependency -> source evidence`

The work should be delivered as three independently deployable vertical slices. Do not rewrite the existing analyzer, Normalized IR, SQLite persistence, evidence, System Map, or Ask AI architecture unless a verified defect prevents the target journey.

#### Stage 1: Product Entry And Core CardDemo Experience

Goal: a first-time visitor should understand the product within 30 seconds and reach a useful CardDemo explanation with one primary action.

Implementation scope:

- make `/` the primary English product route and keep Korean at `/ko`;
- update English-first metadata, SEO title and description, and OpenGraph metadata;
- replace analyzer-first messaging with the value proposition `Understand unfamiliar COBOL systems in minutes.`;
- provide `Explore CardDemo` as the primary CTA and `Analyze GitHub Repository` as the secondary CTA;
- explain that AWS CardDemo is a sample mainframe credit-card application containing COBOL, JCL, copybooks, batch jobs, and transaction-processing logic;
- promote Ask AI to the main product entry point instead of requiring entity-name or System Map knowledge first;
- provide CardDemo questions that the persisted analysis can answer, including system overview, transaction flow, and major batch jobs;
- route suggested questions through explicit deterministic intents such as `system-overview`, `transaction-flow`, and `batch-jobs`;
- return explanation, verified Mermaid when appropriate, and source evidence for the primary transaction-flow question;
- keep the landing page and basic Ask AI interaction usable on mobile and tablet;
- retain a deterministic answer when Gemini credentials are absent or an AI request fails.

Stage 1 completion criteria:

- a visitor understands that the product helps comprehend unfamiliar COBOL systems;
- the visitor understands what CardDemo represents;
- one click opens the CardDemo experience;
- one suggested-question click returns explanation, visualization, and evidence;
- factual Mermaid nodes and edges originate only from Normalized IR queries.

#### Stage 2: Verified Exploration And Impact Analysis

Goal: connect an AI answer to interactive graph exploration and the exact source lines that prove each reported relationship.

Implementation scope:

- simplify workspace navigation to `Ask AI`, `System Map`, `Source`, and `Analysis Quality`;
- make entities in AI answers and visualizations selectable;
- provide contextual entity questions such as `Explain this program`, `What calls this?`, `Show dependencies`, `What happens if this changes?`, and `Show source evidence`;
- choose verified Mermaid for compact flows and `@xyflow/react` for dependency neighborhoods and impact graphs;
- default System Map to a bounded one-hop neighborhood with optional two-hop and three-hop expansion;
- continue server-side bounded graph queries and never send or render the complete repository graph by default;
- aggregate repeated unresolved targets into a summary with an explicit `Show unresolved` action;
- distinguish analysis status (`Verified`, `Partial`, `Unresolved`) from content origin (`Static analysis`, `AI explanation`);
- make graph relations and AI evidence links open a Source Viewer with file path, language/type, original line numbers, highlighted evidence, related entity, and related relation;
- provide navigation back to the AI answer or graph and an action to explore the related entity;
- implement impact analysis through deterministic traversal, then let Gemini explain the verified impact graph;
- correct bidirectional traversal and direction-sensitive Ask AI behavior before relying on multi-hop or impact results.

Stage 2 completion criteria:

- a user can select a program from an AI answer and open its dependency neighborhood;
- selecting a relationship exposes the associated evidence;
- selecting evidence opens the correct source lines with highlighting;
- `What happens if this changes?` returns a deterministic impact graph plus explanation and evidence;
- unresolved references remain visible and honest without dominating the default graph;
- the complete journey from question to source proof works without requiring prior CardDemo identifier knowledge.

#### Stage 3: Repository Onboarding And Production Polish

Goal: let a developer analyze a supported public GitHub repository and understand the result without landing on an internal metrics dashboard.

Implementation scope:

- simplify the repository form around one public GitHub URL and state that repository code is analyzed but never executed;
- accurately label public repositories as supported and private/on-premise analysis as unavailable, coming later, or contact-based;
- return an ingestion run id immediately and connect the UI to real persisted backend phases;
- expose concrete phases such as cloning, file discovery, COBOL analysis, copybook resolution, JCL analysis, dependency graph construction, coverage calculation, and ready;
- show the exact failed phase and a safe actionable error instead of a fake progress animation;
- present an orientation summary after analysis, including COBOL files, programs, copybooks, jobs, verified/partial relationships, and unresolved findings;
- provide `Ask AI`, `Open System Map`, and `View Analysis Quality` as the next actions after completion;
- make Analysis Quality explain files analyzed, entity coverage, relation coverage, evidence coverage, unresolved findings, and the difference between repository-wide coverage and finding-level confidence;
- finish responsive, loading, empty, error, retry, and truncated-result states;
- prepare anonymous aggregate telemetry hooks for ingestion outcome, file counts, unsupported/unresolved categories, feature and intent usage, graph usage, and duration;
- never collect source text, source snippets, or private repository contents in default telemetry;
- update README and AWS/Docker operations documentation and run the complete acceptance journey after deployment.

Stage 3 completion criteria:

- a supported public GitHub repository can be submitted and analyzed without executing its code;
- progress reflects actual backend phases and failures identify the phase that failed;
- completion leads to an understandable repository orientation rather than a raw analysis dashboard;
- Ask AI, System Map, Source Evidence, and Analysis Quality work for the newly persisted project;
- runtime SQLite data survives container replacement according to the documented persistence strategy.

#### Cross-Stage Product And Safety Rules

- The LLM must not create factual entities, relationships, impact paths, Mermaid edges, or XYFlow edges.
- Static analysis produces Normalized IR; deterministic queries produce `GraphVisualization`; Gemini explains the verified result.
- Every reported verified relationship should remain traceable to persisted source evidence.
- Coverage describes how much of the repository was analyzed; confidence describes the reliability of one finding. The UI must not present them as the same metric.
- Internal terms such as `Normalized IR`, analyzer ids, and engine versions belong in architecture or secondary quality details, not the primary product hierarchy.
- The visual priority is user task, answer, visualization, evidence, then technical analysis metadata.
- Analyzer expansion is in scope only when an analyzer limitation prevents a primary CardDemo or impact-analysis scenario from working.

Final acceptance journey:

1. Open the English landing page and understand the product within 30 seconds.
2. Understand that CardDemo is a sample mainframe credit-card application.
3. Open CardDemo with one click.
4. Run `How does a credit card transaction flow through this system?`.
5. See an explanation and a verified visual flow.
6. Select a program in the flow and open its dependency neighborhood.
7. Select a relationship and inspect its source evidence.
8. Open the exact highlighted COBOL or JCL source lines.
9. Run `What happens if this changes?` for a selected entity.
10. Inspect the deterministic impact graph, explanation, and supporting evidence.

The product UX iteration is successful when a developer who has never seen CardDemo can understand an important part of the system without manually reading dozens of COBOL and JCL files.

### 18. Strengthen The File And Database Data Layer

Status: planned.

Program-call and copybook dependency graphs are necessary but insufficient for modernization and fragmentation planning. COBOL systems are organized around persistent data streams, so the product must also explain which programs and jobs produce, mutate, and consume VSAM files, sequential datasets, and DB2 data, and how their record layouts are defined.

The data-layer journey is:

`Data asset -> producer/consumer flow -> record layout -> field usage -> change impact -> isolation boundary evidence`

This is a first-class analysis and product workstream, not an LLM-only visualization feature. Data assets, access operations, layouts, and field relationships must be extracted into Normalized IR with provenance before they are displayed or explained.

#### Normalized Data Asset Model

Extend the normalized model only through the existing engine-adapter boundary. The minimum data-oriented entity model should represent:

- VSAM datasets, with statically known organization such as KSDS, ESDS, or RRDS when available;
- sequential files, partitioned datasets, and GDG references;
- JCL DD statements and dataset references;
- COBOL file definitions and file descriptors;
- DB2 tables and views referenced by embedded SQL;
- record layouts and records;
- fields, including qualified names, hierarchy, level number, data type/PIC, usage, offset, and length when statically derivable;
- copybooks that define or contribute to a file or database host-variable layout.

Use explicit normalized relations where evidence supports them:

- `READS`: a program, step, or utility consumes a dataset or table;
- `WRITES`: a program, step, or utility creates or appends data;
- `UPDATES`: an existing record or database row may be changed;
- `DELETES`: a record or database row may be removed;
- `OPENS`: a COBOL program opens a file with an observed mode;
- `DEFINED_BY`: a data file or record uses a record layout or copybook definition;
- `MAPS_TO`: a COBOL file definition or JCL DD resolves to a dataset when statically knowable;
- `CONTAINS`: a layout contains records or fields and preserves their hierarchy;
- `PASSED_TO`: a dataset produced by one job step is consumed by another when the JCL chain proves the connection.

Each access relation must retain operation-level details where available, including access mode, source statement type, file/DD name, resolved physical dataset or table name, dynamic-name status, confidence, and evidence location. Do not collapse `READ`, `WRITE`, `REWRITE`, SQL `UPDATE`, and JCL dataset disposition into one ambiguous `USES` edge.

#### Deterministic Extraction And Resolution

Add tolerant, evidence-preserving extraction for:

- COBOL `SELECT`, `ASSIGN`, `FD`, `SD`, `OPEN`, `READ`, `WRITE`, `REWRITE`, `DELETE`, `START`, and `CLOSE` statements;
- `RECORD CONTAINS`, `RECORDING MODE`, `BLOCK CONTAINS`, record-name, and copybook-backed FD layouts;
- JCL `DD`, `DSN`, `DISP`, temporary datasets, passed datasets, GDG references, and relevant utility steps;
- embedded SQL `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`, cursor declarations, and referenced table/view names;
- host variables and copybook fields used at DB2 boundaries where the mapping is statically demonstrable;
- program file-name to JCL DD-name to physical dataset resolution;
- record-layout and field references while preserving original source line mappings through normalization.

Resolution must distinguish:

- `Verified`: the complete program/file/DD/dataset or program/SQL/table chain is statically supported;
- `Partial`: an access operation is known but a physical dataset, layout, or field mapping is incomplete;
- `Unresolved`: a dynamic name, missing copybook, external catalog, or unsupported construct prevents resolution.

Dynamic dataset names, symbolic JCL parameters, alternate file definitions, utility-specific transformations, and DB2 aliases must remain explicit findings. Gemini must not fill these gaps with invented mappings.

#### Data Query Layer

Add bounded deterministic queries over SQLite before adding data-oriented AI answers:

- `getDataAssets` with type, status, and access filters;
- `getDataAssetProducers` and `getDataAssetConsumers`;
- `getProgramDataAccesses` and `getJobDataFlow`;
- `getDatasetLifecycle` across ordered JCL steps and jobs;
- `getRecordLayout` and `getFieldHierarchy`;
- `getProgramsUsingLayout`, `getProgramsUsingField`, and `getProgramsUpdatingTable`;
- `getDataImpactPaths` for upstream and downstream traversal;
- `getCrossBoundaryReads` and `getCrossBoundaryWrites` for a proposed set of program or job groups;
- `getUnresolvedDataBindings` grouped by reason and construct type.

All queries must be project/run scoped, directionally correct, cycle safe, hop limited, and response limited. Field-level impact should traverse only relation types that are semantically valid for the requested question.

#### Data-Centered Product Views

Keep control flow and data flow available as distinct views so relation semantics remain readable:

1. **Program Flow** shows program calls, copybook use, and job-step execution.
2. **Data Flow** shows producer and consumer paths such as `Job/Program -> READS/WRITES/UPDATES -> Dataset/Table`.
3. **Data Model** shows `Dataset/Table -> Record/Layout -> Field` hierarchy and the defining copybook or source structure.
4. **Change Impact** shows verified upstream and downstream effects of changing a dataset, table, layout, or field.
5. **Isolation Boundary** summarizes cross-boundary reads and writes for a proposed fragmentation candidate.

The Data Flow view should default to one selected data asset and a bounded producer/consumer neighborhood. It must not render every data asset or access relation in the repository. The layout viewer should use a hierarchy or compact table rather than forcing thousands of fields into XYFlow.

Suggested data-oriented questions should include:

- `Which programs read and write this VSAM file?`
- `Which jobs produce this dataset, and which jobs consume it?`
- `Which copybook defines this file layout?`
- `Which programs update this DB2 table?`
- `Where is this field populated before it is persisted?`
- `What breaks if this record layout changes?`
- `Can this data domain be isolated without creating cross-boundary writes?`

Question intents must select deterministic queries first. Gemini may explain access patterns, business meaning, fragmentation candidates, and trade-offs, but it must not create data assets, access operations, field mappings, or isolation edges.

#### Delivery Alignment With The Three UX Stages

During Stage 1:

- benchmark a pinned COBOL-REKT commit against CardDemo before expanding the TypeScript analyzer for Data Division and field-lineage features it may already provide;
- map any adopted COBOL-REKT output through the engine adapter into Normalized IR rather than exposing its native AST, graph, or Neo4j model to the product;
- inventory the CardDemo data assets that are already statically observable;
- expose verified/partial READ and WRITE relations in CardDemo orientation and suggested answers;
- show at least one source-backed producer/consumer example without requiring users to know a dataset name;
- report data-analysis coverage and unresolved data bindings honestly.

During Stage 2:

- add the bounded Data Flow neighborhood and record-layout viewer;
- connect data edges and layout fields to Source Viewer evidence;
- support field, layout, dataset, and table impact traversal;
- expose grouped unresolved DD, dataset, layout, and table mappings;
- add data-oriented contextual questions and verified visual answers.

During Stage 3:

- include discovered data-asset counts and data-access coverage in repository orientation;
- include real file, JCL, copybook-resolution, and DB2 extraction phases in ingestion progress;
- add producer/consumer and cross-boundary query support for user-ingested projects;
- present isolation candidates as AI recommendations over verified access graphs, never as verified architecture facts;
- validate performance and response limits on repositories with large field and dataset counts.

#### Data Analysis Quality And Coverage

Extend Analysis Quality with separate data-oriented measures:

- data assets discovered by type;
- COBOL file definitions resolved to JCL DD statements;
- DD statements resolved to physical datasets;
- record layouts resolved and fields structurally extracted;
- data-access operations with source evidence;
- DB2 statements with resolved table/view targets;
- verified, partial, and unresolved data relations;
- unresolved bindings grouped by missing copybook, dynamic dataset, symbolic JCL, external catalog, SQL ambiguity, and unsupported construct;
- field-level evidence coverage and confidence distribution.

Coverage must describe how much of the observable data surface was resolved. Confidence remains finding-specific. For example, repository-wide DD-to-dataset coverage may be partial while one `Program -> READS -> Dataset` relation is still verified with direct COBOL and JCL evidence.

#### Data-Layer Completion Criteria

- a user can select a VSAM file, sequential dataset, or DB2 table and see verified producers and consumers;
- a user can trace a COBOL file access through its DD statement to a physical dataset when the repository contains sufficient evidence;
- a user can inspect the defining record layout and field hierarchy with original source locations;
- changing a dataset, layout, table, or field produces a bounded deterministic impact graph with evidence;
- the product distinguishes reads from writes, updates, and deletes instead of presenting an undifferentiated dependency;
- unresolved and dynamic bindings are aggregated but remain inspectable;
- a proposed isolation boundary reports cross-boundary reads and writes derived from static relations;
- any fragmentation recommendation is labeled as AI interpretation and cites the verified access graph and source evidence it relies on.

This workstream is successful when the product can explain not only which programs depend on each other, but also how persistent business data moves through the system and which verified data couplings constrain a safe fragmentation strategy.

## Deployment Strategy

Docker deployment is compatible with the adapter-first strategy and is recommended for reproducibility.

Start with one container for the PoC:

- Next.js app
- Python runtime and virtual environment
- optional `cobol-intel`
- optional Java runtime and pinned COBOL-REKT build only if the benchmark selects it
- local SQLite database
- analysis cache volume

Split into `web` and `analysis` containers later if analysis becomes slow, stateful, or operationally noisy.

Do not port `cobol-intel` or COBOL-REKT wholesale to Node unless a later benchmark proves that CLI/API wrapping is not viable. Do not add Neo4j to the deployment solely to consume COBOL-REKT; prefer its deterministic JSON, GraphML, or Java API surface and normalize that output into SQLite.

## Deferred Until After MVP

- full TypeScript COBOL engine rewrite;
- vector search;
- broad business flow reconstruction;
- Monaco Editor;
- advanced AI tool calling if simple server-side routing is enough;
- automatic DB2/VSAM inference beyond statically verified evidence;
- multi-container worker queue unless analysis latency requires it.
