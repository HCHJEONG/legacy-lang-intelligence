# Legacy Language Intelligence

COBOL Intelligence PoC for the AWS Mainframe Modernization CardDemo sample.

The product principle is:

`AI explains. Static analysis verifies. Source code proves.`

## Deployment Assumption

This project is expected to be deployed by the user to an AWS private instance through shell scripts, following the deployment style of the `semantic-layer-explore` repository.

The public remote repository is:

`git@github.com:HCHJEONG/legacy-lang-intelligence.git`

Managed frontend deployment platforms are not the default target.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## CardDemo Ingestion

Run:

```bash
npm run ingest
```

By default, the script clones CardDemo into `.cache/carddemo`, which is ignored by git.

To use an existing checkout:

```bash
CARDDEMO_SOURCE_DIR=/path/to/aws-mainframe-modernization-carddemo npm run ingest
```

The first implementation writes static analysis output to:

`analysis-output/carddemo-analysis.json`

It also writes the Normalized IR output to:

`analysis-output/carddemo-normalized-ir.json`

To generate a baseline coverage report from the Normalized IR:

```bash
npm run coverage
```

This writes:

- `analysis-output/carddemo-coverage-report.json`
- `analysis-output/carddemo-coverage-report.md`

That output is also ignored by git because it is generated local analysis data.

To persist the latest Normalized IR into SQLite:

```bash
npm run persist
```

By default this writes:

`analysis-output/carddemo.sqlite`

To enable the optional verified-context Gemini explanation layer, configure the key on the server only:

```bash
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.0-flash
```

Without a key, Ask AI returns a deterministic summary from the SQLite graph and source evidence.

## Current MVP Scope

The current implementation covers steps 1 through 14 of the plan:

1. Next.js TypeScript app initialization
2. CardDemo fixture/clone strategy
3. File discovery and classification
4. Minimal COBOL, Copybook, and JCL static analysis
5. `cobol-intel` benchmark
6. Normalized IR, provenance, and coverage model
7. CardDemo baseline coverage report
8. tolerant COBOL source normalization
9. SQLite persistence schema and CardDemo persistence script
10. Persisted entities, relations, evidence, and coverage
11. Deterministic SQLite query layer
12. Analysis Quality dashboard
13. Search-first System Map and source evidence viewer
14. Verified-context Ask AI with Gemini and deterministic fallback

The next phase is public GitHub URL based ingestion with isolated repository handling.

## Language Support

English is the default at `/en`. Korean is available at `/ko`; switching language preserves the current search and System Map query state. Both locales share the same UI components and typed messages.

## Ingestion Operations

The current PoC fetches a public GitHub repository, pins the HEAD commit, creates an isolated shallow clone, runs the existing analysis pipeline, and persists the result. Production hardening will add asynchronous worker state, progress polling, cancellation, concurrency limits, and retention cleanup.

For the first AWS private-instance deployment, prefer `t3a.medium` if `t3a.small` is already hosting two containers. The application can share the medium during PoC with ingestion concurrency limited to one; move ingestion to a separate worker host when sustained analysis or memory pressure appears in CloudWatch.

The initial nginx integration expects the container name and network alias `cobolai` on `lawvot_net`, with the public host `cobolai.penvot.com`. The existing lawvot frontend host should be exposed as `physicalai.penvot.com`.

## Product UX Principle

The System Map must be search-first, not full-graph-first.

Use this flow:

`Search -> Entity -> Neighborhood -> Follow relation -> Source`

The app should show Analysis Quality before or alongside graph exploration so users can see what the analyzer verified and what remains unresolved.

## Source Attribution

The analyzed target is the AWS sample repository:

`https://github.com/aws-samples/aws-mainframe-modernization-carddemo`

CardDemo source should remain outside committed app code unless a fixture strategy is explicitly documented.
