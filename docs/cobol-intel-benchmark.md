# cobol-intel Benchmark

Date: 2026-08-08

## Summary

`cobol-intel` is real, installable, and structurally close to the engine we hoped to find. It provides a CLI, a Python package, contracts, an ANTLR/Lark parser area, call graph output, data-flow output, impact analysis, documentation generation, and a FastAPI application entrypoint.

However, version `0.3.1` is not currently suitable as the primary CardDemo analysis engine without upstream fixes, local patches, or a compatibility preprocessor. It failed to parse all CardDemo COBOL files tested.

Recommendation:

Use `cobol-intel` as an optional research/benchmark engine for now. Keep the current TypeScript analyzer as the working baseline and fallback. Do not build the persistence schema around `cobol-intel` native output yet.

## Environment

- Project: `legacy-lang-intelligence`
- Python used for benchmark: `3.11.4`
- Package: `cobol-intel==0.3.1`
- Installed in ignored path: `.cache/cobol-intel-venv`
- CardDemo source: `.cache/carddemo`
- CardDemo commit tested: `59cc6c2fd7ebd7ef7925cad552a01a4b8b6e4d5e`

## Package Metadata

Observed via `pip show cobol-intel`:

- Name: `cobol-intel`
- Version: `0.3.1`
- Summary: `Open-source platform for understanding, documenting, and analyzing legacy COBOL codebases using static analysis and LLM`
- Home page in package metadata: `https://github.com/WwzFwz/cobol-intel`
- License: MIT
- Requires Python: `>=3.11`

The installed wheel includes an MIT license file at:

`.cache/cobol-intel-venv/Lib/site-packages/cobol_intel-0.3.1.dist-info/licenses/LICENSE`

The package metadata GitHub URL was checked with:

`git ls-remote https://github.com/WwzFwz/cobol-intel.git HEAD`

Result:

`Repository not found.`

So the PyPI/wheel license is visible, but the source repository referenced by the package metadata was not publicly accessible during this benchmark.

## Installed Dependencies

Direct package requirements observed:

- `anthropic`
- `antlr4-python3-runtime`
- `lark`
- `networkx`
- `ollama`
- `openai`
- `pydantic`
- `rich`
- `typer`

The API entrypoint imports `fastapi` and `uvicorn`, but they were not installed by `pip install cobol-intel`. They had to be installed manually during inspection.

## CLI Surface

The installed console scripts are:

- `cobol-intel`
- `cobol-intel-api`

`cobol-intel --help` exposes:

- `analyze`
- `explain`
- `graph`
- `impact`
- `docs`

The CLI shape is a good conceptual fit for this project. It can be wrapped from Node as a Python CLI process if compatibility improves.

## Internal Structure

The installed package includes:

- `cobol_intel.analysis`
- `cobol_intel.api`
- `cobol_intel.cli`
- `cobol_intel.contracts`
- `cobol_intel.llm`
- `cobol_intel.outputs`
- `cobol_intel.parsers`
- `cobol_intel.service`

Important observed files:

- `cobol_intel/service/pipeline.py`
- `cobol_intel/parsers/antlr_parser.py`
- `cobol_intel/parsers/preprocessor.py`
- `cobol_intel/contracts/ast_output.py`
- `cobol_intel/contracts/graph_output.py`
- `cobol_intel/contracts/impact_output.py`

The service pipeline discovers only COBOL source files with suffixes:

- `.cbl`
- `.cob`
- `.cobol`

It does not discover JCL or copybooks as independent first-class source artifacts. Copybooks are used by the preprocessor when referenced from COBOL.

## Positive Result: Simple COBOL Works

A minimal test program in `.cache/cobol-intel-fixtures/hello/HELLO.cbl` completed successfully.

Command:

`cobol-intel analyze .cache/cobol-intel-fixtures/hello -o .cache/cobol-intel-runs/hello`

Result:

- Status: `completed`
- AST JSON generated
- call graph JSON generated
- data-flow JSON generated
- Mermaid graph generated
- docs generated

Example observed AST fields:

- `program_id`
- `file_path`
- `parser_name`
- `data_items`
- `paragraphs`
- `copybooks_used`

Example observed graph fields:

- `nodes`
- `edges`
- `adjacency`
- `entry_points`
- `external_calls`

This output shape is adapter-friendly.

## Negative Result: CardDemo Fails

Command:

`cobol-intel analyze .cache/carddemo/app -o .cache/cobol-intel-runs/carddemo-app ...`

Result:

- Status: `failed`
- Files total: `44`
- Files successful: `0`
- Files failed: `44`
- Warning count: `132`
- Error count: `416`
- No AST artifacts generated
- Empty call graph generated

The first dominant failures were:

- `mismatched input 'AUTHOR' expecting {<EOF>, 'ENVIRONMENT', 'DATA', 'PROCEDURE'}`
- `mismatched input 'DATE-WRITTEN' expecting {<EOF>, 'ENVIRONMENT', 'DATA', 'PROCEDURE'}`
- `mismatched input 'CONFIGURATION' expecting {<EOF>, 'DATA', 'PROCEDURE'}`

A sanitized copy of one CardDemo submodule was also tested with `AUTHOR`, `INSTALLATION`, `DATE-WRITTEN`, `DATE-COMPILED`, and `SECURITY` lines removed.

Result:

- Still failed.
- The next blocker was `CONFIGURATION SECTION`.

This suggests the current grammar is too narrow for CardDemo's COBOL dialect/style.

## Comparison With Current TypeScript Baseline

Current local TypeScript baseline analyzer against CardDemo:

- Files discovered: `237`
- COBOL files: `45`
- Copybooks: `61`
- JCL files: `55`
- Entities: `6124`
- Dependencies: `8638`

`cobol-intel` against CardDemo app:

- COBOL files discovered: `44`
- Successful parses: `0`
- Entities usable for our app: `0`
- Dependencies usable for our app: `0`

The current baseline is much less sophisticated, but it is more useful for CardDemo today.

## Fit Against The Step 5 Questions

Can it analyze CardDemo without manual source restructuring?

No. It failed all CardDemo COBOL files tested.

What commands, library APIs, or REST APIs are available?

CLI commands are available and good. Python service APIs are available. REST API source exists, but API dependencies are incomplete in the package metadata.

Can it emit stable JSON or another machine-readable output?

Yes, when parsing succeeds. It emits versioned JSON artifacts for AST, graph, data-flow, CFG, references, dead code, metrics, and manifest.

Does it provide program, copybook, field, call graph, JCL, CFG, data-flow, impact, and source-location data?

It provides program AST, copybook usage, data items, call graph, CFG, data-flow, reference index, dead code, impact, docs, and Mermaid for COBOL. It does not appear to model JCL as first-class input. Source references are present in contracts but were often `null` in the simple test output.

Does it resolve copybooks better than the current baseline analyzer?

Not proven. CardDemo runs produced many missing copybook warnings and no successful parses.

What evidence model does it expose?

It exposes manifests, errors, warnings, metrics, and contracts with source reference fields. The evidence/source-location quality was not sufficient in the simple passing test because source fields were `null`.

How usable are Mermaid outputs?

Usable when parsing succeeds. The simple test generated Mermaid and graph JSON. CardDemo produced an empty graph.

What dependencies are required?

Python 3.11+, ANTLR Python runtime, NetworkX, Pydantic, Typer, Rich, OpenAI/Anthropic/Ollama clients, and optionally FastAPI/Uvicorn for REST.

Is the license compatible?

The installed wheel declares MIT and includes an MIT license file. The package metadata GitHub repo was not publicly accessible, so repository-level verification is incomplete.

How does performance look on CardDemo?

Fast but failed. The full CardDemo app parse attempt finished in about 4.1 seconds with 0 successful parses.

## Recommendation

Do not adopt `cobol-intel==0.3.1` as the primary engine yet.

Use it in one of these narrower ways:

- optional benchmark engine;
- reference for output contracts and artifact organization;
- future adapter target if upstream compatibility improves;
- possible fork/patch candidate only after comparing effort against improving our own analyzer.

Immediate next implementation should proceed with:

1. keep current TypeScript analyzer as baseline;
2. define a normalized adapter contract that can ingest both our baseline output and future `cobol-intel` output;
3. avoid coupling SQLite schema to `cobol-intel`;
4. revisit `cobol-intel` after checking whether upstream source becomes available or grammar fixes are feasible.

