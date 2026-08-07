# AGENTS.md

## Primary Deployment Assumption

This repository is intended to be deployed by the user to an AWS private instance through shell scripts, following the deployment style and operational precedent of the `semantic-layer-explore` repository.

The public remote repository for this project is expected to be:

`git@github.com:HCHJEONG/legacy-lang-intelligence.git`

Implementation decisions should therefore prefer:

- scriptable setup and deployment via `sh`-compatible scripts;
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

## Core Architecture Rule

The LLM must not invent repository structure, dependencies, Mermaid diagrams, or graph relationships.

The expected flow is:

1. Repository/file discovery
2. Deterministic static analysis
3. Entity and dependency extraction
4. SQLite persistence
5. Graph query and source retrieval
6. Gemini explanation
7. UI rendering with text, evidence, and verified visualization

Gemini may explain, summarize, name useful views, and provide business interpretation. Verified graph nodes and edges must come from static analysis and database queries.

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

## Review Checklist For Future Agents

Before implementing major features, confirm:

- the actual CardDemo repository structure;
- available COBOL, Copybook, JCL, CICS, VSAM, DB2, and dataset artifacts;
- current official Gemini Flash model IDs and SDK recommendations;
- current Next.js, React, Tailwind, Drizzle, Mermaid, and `@xyflow/react` APIs;
- whether the implementation still supports script-based AWS private instance deployment.
