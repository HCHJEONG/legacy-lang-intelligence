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

That output is also ignored by git because it is generated local analysis data.

## Current MVP Scope

The current implementation covers steps 1 through 4 of the plan:

1. Next.js TypeScript app initialization
2. CardDemo fixture/clone strategy
3. File discovery and classification
4. Minimal COBOL, Copybook, and JCL static analysis

SQLite/Drizzle persistence starts after the first analysis pass clarifies the actual CardDemo artifact shapes.

## Source Attribution

The analyzed target is the AWS sample repository:

`https://github.com/aws-samples/aws-mainframe-modernization-carddemo`

CardDemo source should remain outside committed app code unless a fixture strategy is explicitly documented.
