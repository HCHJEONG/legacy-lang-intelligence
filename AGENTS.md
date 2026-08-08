# AGENTS.md

## Primary Deployment Assumption

This repository is intended to be deployed by the user to an AWS private instance through shell scripts, following the deployment style and operational precedent of the `semantic-layer-explore` repository.

The public remote repository for this project is expected to be:

`git@github.com:HCHJEONG/legacy-lang-intelligence.git`

Implementation decisions should therefore prefer:

- scriptable setup and deployment via `sh`-compatible scripts;
- reproducible Docker deployment when it improves dependency control;
- explicit environment variables instead of hidden local state;
- reproducible installation, ingestion, build, and start commands;
- server-side operation suitable for a private AWS instance;
- clear separation between local development defaults and private-instance deployment defaults.

Do not assume deployment to Vercel, Netlify, or another managed frontend platform unless the user explicitly changes this requirement.

## Project Goal

Build a COBOL Intelligence PoC web application for the AWS Mainframe Modernization CardDemo sample repository.

The application should statically analyze COBOL, Copybook, JCL, and related mainframe assets, persist verified entities and dependencies, and let Ask AI explain the analyzed system with source-backed evidence and visual diagrams.

The product principle is:

`AI explains. Static analysis verifies. Source code proves.`

The product differentiation is not owning every static-analysis primitive. It is the accessible web experience:

`Open website -> paste GitHub URL or choose CardDemo -> analyze -> explore system visually -> Ask AI`

## Core Architecture Rule

The LLM must not invent repository structure, dependencies, Mermaid diagrams, or graph relationships.

The expected flow is:

1. Repository/file discovery
2. Deterministic static analysis through an engine adapter
3. Normalized entity, dependency, and evidence extraction
4. SQLite persistence
5. Graph query and source retrieval
6. Gemini explanation
7. UI rendering with text, evidence, and verified visualization

Gemini may explain, summarize, name useful views, and provide business interpretation. Verified graph nodes and edges must come from static analysis and database queries.

## Static Analysis Engine Strategy

Do not assume the final COBOL analysis engine must be implemented from scratch in TypeScript.

The current TypeScript analyzer is a baseline, smoke test, and fallback. Before expanding it, benchmark `cobol-intel` against CardDemo and decide whether to use it as the primary engine, an optional engine, or not at all.

Prefer an adapter boundary:

`cobol-intel / TypeScript fallback / future engines -> normalized analysis model -> SQLite -> UI and Ask AI`

If `cobol-intel` is adopted, wrap it as a Python CLI/library/service from the Node app. Do not port the whole engine to Node unless benchmarking proves wrapping is not viable.

## Normalized IR And Partial Analysis

Normalized IR is the product center. UI, Ask AI, Mermaid, XYFlow, and SQLite should depend on normalized entities, relations, evidence, provenance, and coverage reports instead of analyzer-native output.

This project is a legacy comprehension utility, not a COBOL compiler. Do not optimize for strict parse success at the expense of useful partial analysis.

The project should own a tolerant COBOL normalization layer before any strict parsing assumptions. This layer should absorb common real-world COBOL noise such as fixed-format columns, sequence numbers, comment banners, `AUTHOR`, `INSTALLATION`, `DATE-WRITTEN`, `DATE-COMPILED`, `SECURITY`, and other identification/header paragraphs while preserving original source line mapping for evidence.

Prefer tolerant extraction:

- extract what is statically knowable;
- attach source evidence and source locations whenever possible;
- preserve original source locations even when analyzing normalized text;
- mark unresolved, unsupported, dynamic, or low-confidence findings explicitly;
- preserve analyzer id, analyzer version, extraction method, confidence, and confidence reason;
- report coverage honestly instead of pretending analysis is complete.

Primary benchmark metrics should be:

- meaningful entities extracted;
- meaningful relations extracted;
- evidence coverage;
- normalization coverage;
- unresolved reference counts;
- unsupported construct counts;
- confidence distribution;
- analyzer agreement and disagreement when multiple analyzers are used.

When two analyzers agree on a relation, confidence may increase. When they disagree, lower confidence or mark the relation for review; do not silently hide the disagreement.

## Visualization Rule

Use a unified graph visualization model as the source of truth for both Mermaid and `@xyflow/react`.

Mermaid is suitable for small flows, sequence-like explanations, and compact dependency diagrams.

`@xyflow/react` is suitable for interactive graph exploration, impact analysis, upstream/downstream traversal, and larger dependency neighborhoods.

Raw Mermaid generated directly by the LLM should not be trusted as factual graph data.

## Implementation Preferences

- Use TypeScript strict mode.
- Prefer SQLite and Drizzle ORM for persisted analysis data.
- Validate structured AI and visualization outputs with Zod.
- Keep parser/static analysis code separate from AI code.
- Keep engine-native output separate from the normalized analysis model.
- Treat coverage reports as first-class artifacts.
- Treat source normalization metrics and source maps as first-class analysis artifacts.
- Prefer deterministic graph traversal before any LLM explanation.
- Avoid introducing vector search until structured graph retrieval proves insufficient.
- Keep CardDemo source outside this repository unless a fixture strategy is explicitly documented.
- Document source attribution and license handling for any cloned or cached CardDemo content.

## Commands And Scripts

The project should eventually expose predictable commands similar to:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run ingest`
- `npm run test`

Deployment scripts should live in a script directory, for example:

- `scripts/setup.sh`
- `scripts/deploy.sh`
- `scripts/ingest-carddemo.ts`

Exact script names may evolve, but private AWS instance deployment must remain a first-class path.

Docker support is compatible with the preferred architecture. For the PoC, a single container may include Next.js, Python, `cobol-intel`, SQLite, and analysis cache directories. Split into separate `web` and `analysis` containers later only if runtime behavior requires it.

## Review Checklist For Future Agents

Before implementing major features, confirm:

- the actual CardDemo repository structure;
- available COBOL, Copybook, JCL, CICS, VSAM, DB2, and dataset artifacts;
- `cobol-intel` package/repository license, APIs, output shape, dependencies, and CardDemo compatibility;
- whether current analyzer changes improve CardDemo entity, relation, evidence, unresolved, and unsupported-construct coverage;
- current official Gemini Flash model IDs and SDK recommendations;
- current Next.js, React, Tailwind, Drizzle, Mermaid, and `@xyflow/react` APIs;
- whether the implementation still supports script-based AWS private instance deployment and Docker deployment.
