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

The current PoC fetches a public GitHub repository, pins the HEAD commit, creates an isolated shallow clone, runs the existing analysis pipeline, and persists the result. The web API now returns an ingestion run id immediately, records phase/progress state in SQLite, exposes `GET /api/ingest/status?runId=...`, supports user cancellation through `DELETE /api/ingest/status?runId=...`, reuses a completed analysis when the same repository commit was already persisted, and limits repository ingestion concurrency to one active run for the initial private-instance deployment.

The UI polls the persisted run state and shows concrete phases such as cloning, file discovery/static analysis, COBOL/copybook/JCL extraction, graph and coverage persistence, completion, failure, or cancellation. Completed runs show an orientation summary and next actions for Ask AI, System Map, and Analysis Quality.

For the first AWS private-instance deployment, prefer `t3a.medium` if `t3a.small` is already hosting two containers. The application can share the medium during PoC with ingestion concurrency limited to one; move ingestion to a separate worker host when sustained analysis or memory pressure appears in CloudWatch.

The AWS deployment does not depend on the existing lawvot nginx repository or ECR. Run `.fordeploy/deploy-aws.sh` from WSL; it builds, saves, copies, and loads the Docker image through the Bastion and replaces only the `cobolai` container. The container uses host port `3300` and container port `3000`. ALB and Route 53 are manually configured, so normal redeployments keep `CONFIGURE_ALB=0`.

The same script automatically creates or refreshes `~/deploy-remote-repo/legacy-lang-intelligence` from `git@github.com:HCHJEONG/legacy-lang-intelligence.git`, fetches `origin/main`, and resets/cleans only that dedicated clone before building. Both `Dockerfile.aws` and the Docker build context come from the verified clone; the commit is logged and recorded in the image's `org.opencontainers.image.revision` label. Commit and push application changes before deployment: uncommitted or unpushed local changes are not build inputs. The deployment launcher itself runs from your working repository.

Override `DEPLOY_BRANCH` (default `main`), `REPO_URL`, or `CLEAN_CLONE_ROOT` when needed. The clone parent must be an absolute path named `deploy-remote-repo`; the child name remains `legacy-lang-intelligence`. The script rejects symlinked checkouts, mismatched origins, and execution from inside the disposable clone. A lock prevents concurrent deployments from resetting the build source. Do not store manual work or secrets in this clone: tracked changes and untracked/ignored files are discarded on refresh. The development checkout is preserved.

```bash
bash .fordeploy/deploy-aws.sh
# Example: deploy a pushed release branch
DEPLOY_BRANCH=release bash .fordeploy/deploy-aws.sh
```

Runtime environment values and credentials stay outside the Docker image. On yws, runtime files live under `/home/ubuntu/cobolai`: `.env.local`, `gcp-key.json`, and `analysis-output/carddemo.sqlite`. The deployment script passes `.env.local` with `--env-file` and bind-mounts `gcp-key.json` plus `analysis-output`.

Image archives are transferred directly to `/home/ubuntu/legacy-lang-intelligence/docker_images` on both the Bastion and private host. Override `REMOTE_BASE_DIR` to change this archive directory; runtime storage remains controlled separately by `APP_DIR_ON_PRIVATE`. Existing runtime files do not need to move. Remote paths must be absolute and contain only letters, digits, `_`, `.`, `/`, and `-`, without parent-directory traversal.

Deployment cleanup runs as follows:

- Exit handlers remove this run's local and remote tar files, including ordinary failures, and remove its local image tag. If SSH is unavailable or a process is killed abruptly, remote cleanup may wait until the next deployment.
- On the next deployment, app-named tar files older than 24 hours are removed from the archive directory and the former `/home/ubuntu` and `/home/ubuntu/docker_images/cobolai/images` locations (only direct files, never runtime data).
- After the HTTP health check succeeds, the private host keeps the current and immediately preceding container image IDs and removes older unused `legacy-lang-intelligence` image tags. It also removes unused dangling images carrying this deployment's AWS label. Images referenced by any container are preserved.
- The fixed `cobolai` container is replaced each time. Stopped leftovers named `cobolai-*` are removed only if they use this application's image; a custom `CONTAINER_NAME` changes that prefix. A host lock serializes replacement and cleanup within the archive directory.
- Failed health checks leave the failed container and previous image available for diagnosis; image retention cleanup waits for a successful deployment. Rollback is manual. Shared Docker volumes, unrelated images/containers, and builder cache are not pruned.

The Docker image should contain application code only. Do not commit `.env.local`, `gcp-key.json`, image archives, SQLite databases, or copied runtime secrets.

## Product UX Principle

The System Map must be search-first, not full-graph-first.

Use this flow:

`Search -> Entity -> Neighborhood -> Follow relation -> Source`

The app should show Analysis Quality before or alongside graph exploration so users can see what the analyzer verified and what remains unresolved.

## Remaining Work

- Confirm ALB target health and the `/en` health check after each deployment without changing the existing DNS or host rules.
- Verify the GCP service account has Vertex AI permissions and Ask AI works with the mounted `/app/gcp-key.json`.
- Add retention cleanup for cached ingestion workspaces.
- Document and verify persistent host storage for `analysis-output/carddemo.sqlite` plus SQLite WAL companion files before production redeploys.
- Add automated integration, security, localization, and production deployment tests.

## Source Attribution

The analyzed target is the AWS sample repository:

`https://github.com/aws-samples/aws-mainframe-modernization-carddemo`

CardDemo source should remain outside committed app code unless a fixture strategy is explicitly documented.
