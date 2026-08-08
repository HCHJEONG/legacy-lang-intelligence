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
GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-key.json
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=global
VERTEX_AI_MODEL_ID=gemini-3.6-flash
```

Without a key, Ask AI returns a deterministic summary from the SQLite graph and source evidence.

## Current MVP Scope

The current implementation covers steps 1 through 15 of the plan:

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
15. Public GitHub fetch, analysis, persistence, and ingestion status tracking

The next phase is production ingestion hardening and deployment verification. Analysis runs are project-scoped; CardDemo remains the default project and a failed or entity-empty GitHub analysis does not replace its visible result.

## Language Support

English is the default at `/en`. Korean is available at `/ko`; switching language preserves the current search and System Map query state. Both locales share the same UI components and typed messages.

## Ingestion Operations

The current PoC fetches a public GitHub repository, pins the HEAD commit, creates an isolated shallow clone, runs the existing analysis pipeline, and persists the result. Production hardening will add asynchronous worker state, progress polling, cancellation, concurrency limits, and retention cleanup.

For the first AWS private-instance deployment, prefer `t3a.medium` if `t3a.small` is already hosting two containers. The application can share the medium during PoC with ingestion concurrency limited to one; move ingestion to a separate worker host when sustained analysis or memory pressure appears in CloudWatch.

The AWS deployment does not depend on the existing lawvot nginx repository or ECR. Run `.fordeploy/deploy-aws.sh` from WSL; it builds, saves, copies, and loads the Docker image through the Bastion and replaces only the `cobolai` container. The container uses host port `3300` and container port `3000`. ALB and Route 53 are manually configured, so normal redeployments keep `CONFIGURE_ALB=0`.

Runtime environment values follow the LawVot pattern: keep secrets in the local `.env.local` file, which is Git-ignored, and include it in the Docker image at `/app/.env.local`. The remote host receives only the image tar under the dedicated application directory; no root-level files or separate runtime config files are overwritten.

Before building, `.fordeploy/deploy-aws.sh` restores `.env.local` from `LEGACY_LANG_ENV_FILE_SOURCE` when the repository root does not have one. The default source is `/mnt/j/VSCodeProjects/legacy-lang-intelligence/.fordeploy/aws-backup/.env.local`; the temporary root copy is removed after deployment, or the original root file is restored.

## Product UX Principle

The System Map must be search-first, not full-graph-first.

Use this flow:

`Search -> Entity -> Neighborhood -> Follow relation -> Source`

The app should show Analysis Quality before or alongside graph exploration so users can see what the analyzer verified and what remains unresolved.

## Remaining Work

- Confirm ALB target health and the `/en` health check after each deployment without changing the existing DNS or host rules.
- Verify the GCP service account has Vertex AI permissions and Ask AI works with the packaged `/app/gcp-key.json`.
- Complete asynchronous ingestion workers, progress UI, cancellation, concurrency limits, duplicate commit reuse, and retention cleanup.
- Add automated integration, security, localization, and production deployment tests.

## Source Attribution

The analyzed target is the AWS sample repository:

`https://github.com/aws-samples/aws-mainframe-modernization-carddemo`

CardDemo source should remain outside committed app code unless a fixture strategy is explicitly documented.
