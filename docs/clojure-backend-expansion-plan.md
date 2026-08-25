# Clojure Backend 확장 계획

작성일: 2026-08-26

## 요약

이 문서는 `legacy-lang-intelligence`를 확장할 때 Next.js는 제품 UI로 유지하고, 분석, 저장소 접근, 그래프 탐색, Ask AI 컨텍스트 구성은 Clojure backend 뒤로 이동하는 방향을 정리한다.

목적은 현재 PoC를 즉시 전면 교체하는 것이 아니다. Next.js API route, 직접 DB 접근, SQLite 고정 설계가 무심코 굳어지기 전에 향후 경계를 명확히 잡는 것이다.

목표 구조:

```text
Next.js UI
  -> Clojure HTTP API만 호출
  -> DB 직접 접근 없음

Clojure Backend
  -> repository discovery
  -> deterministic analysis orchestration
  -> normalized IR
  -> persistence adapter
  -> graph query
  -> source evidence retrieval
  -> Ask AI context construction

Storage
  -> local PoC 기본값은 SQLite
  -> 이후 PostgreSQL / MySQL / MariaDB / MongoDB / Elasticsearch adapter 추가 가능
```

제품 원칙은 유지한다:

`AI explains. Static analysis verifies. Source code proves.`

## 목표

- Next.js는 제품 경험, 렌더링, 그래프 탐색, Ask AI 인터페이스에 집중한다.
- backend truth ownership을 Clojure로 이동한다.
- UI가 DB table이나 특정 storage query 방식에 의존하지 않게 한다.
- analyzer, persistence, graph API, AI context builder 사이의 계약을 normalized IR로 둔다.
- private AWS instance에 script/Docker 기반으로 배포할 수 있게 유지한다.
- SQLite를 영구 아키텍처 전제로 고정하지 않고 명시적인 storage adapter로 교체 가능하게 만든다.

## 비목표

- 명확한 backend 경계 없이 Clojure를 단순한 두 번째 runtime으로 추가하지 않는다.
- LLM이 graph node, graph edge, repository structure, Mermaid diagram을 사실처럼 생성하게 하지 않는다.
- Next.js가 persistence state를 직접 읽고 쓰는 두 번째 backend가 되지 않게 한다.
- 구체적인 제품 필요가 확인되기 전에 LangGraph식 orchestration이 필수라고 가정하지 않는다.
- normalized IR과 query contract가 안정되기 전에 특정 storage engine에 과도하게 최적화하지 않는다.

## Frontend 경계

Next.js는 Clojure API만 호출한다.

허용되는 책임:

- repository URL 입력과 CardDemo preset 선택
- analysis progress UI
- system exploration 화면
- source evidence 표시
- Mermaid와 `@xyflow/react` 기반 graph rendering
- Ask AI chat interface

허용하지 않는 책임:

- SQLite, PostgreSQL, MySQL, MariaDB, MongoDB, Elasticsearch 직접 접근
- static analysis 실행
- normalized IR 생성
- dependency graph 사실 생성
- Ask AI에 넘길 source context 선택
- database migration ownership

이렇게 하면 DB는 Clojure backend의 private implementation detail로 남는다.

## Clojure Backend 경계

Clojure backend가 소유해야 할 책임:

- repository discovery와 source classification
- analysis engine orchestration
- TypeScript fallback analyzer, `cobol-intel`, future engine에 대한 adapter wrapping
- COBOL, Copybook, JCL 및 관련 artifact normalization
- entity, dependency, evidence, provenance, coverage model 생성
- persistence read/write
- graph traversal과 verified visualization model 생성
- Gemini에 넘길 source-backed context retrieval
- analysis run state, retry state, progress reporting

backend API는 DB table 모양이 아니라 안정적인 product resource 형태로 제공한다.

예시 API 영역:

- `POST /api/analysis-runs`
- `GET /api/analysis-runs/:id`
- `GET /api/analysis-runs/:id/coverage`
- `GET /api/entities/:id`
- `GET /api/entities/:id/evidence`
- `GET /api/graph/neighborhood`
- `GET /api/graph/impact`
- `POST /api/ask`

## Normalized IR

IR은 intermediate representation, 즉 중간 표현을 뜻한다. 이 프로젝트에서는 legacy source에서 추출한 사실을 storage와 UI에 독립적인 공통 모델로 표현한 것이다.

예시:

```text
Program COSGN00C uses Copybook DFHAID
Program COSGN00C calls Program COACTUPC
JCL Job XYZ executes Program ABC
File A line 42 is evidence for dependency D
Relation R has high confidence because static analyzer X found it
Reference Q is unresolved because no matching copybook was discovered
```

IR에는 다음이 포함되어야 한다:

- artifact
- entity
- relation
- evidence location
- provenance
- analyzer id와 version
- confidence와 confidence reason
- unresolved reference
- unsupported construct
- coverage metric
- normalization metric

UI, Ask AI, Mermaid, `@xyflow/react`는 analyzer-native output이 아니라 이 IR 모델에 의존해야 한다.

## Persistence Adapter 전략

backend는 storage별 구현체를 추가하기 전에 명시적인 persistence port를 정의해야 한다.

개념적인 protocol:

```clojure
(defprotocol AnalysisStore
  (save-analysis-run! [store run])
  (save-artifacts! [store run-id artifacts])
  (save-entities! [store run-id entities])
  (save-relations! [store run-id relations])
  (save-evidence! [store run-id evidence])
  (save-coverage! [store run-id coverage])
  (get-analysis-run [store run-id])
  (get-entity [store entity-id])
  (find-relations [store query])
  (graph-neighborhood [store query])
  (impact-analysis [store query])
  (source-evidence [store query]))
```

초기 구현 후보:

- `analysis.store.sqlite`
- `analysis.store.postgres`

향후 구현 후보:

- `analysis.store.mysql`
- `analysis.store.mariadb`
- `analysis.store.mongodb`
- `analysis.store.elasticsearch`

다만 Elasticsearch는 보통 primary system of record가 아니라 search adapter로 보는 것이 자연스럽다.

권장 분리:

```text
SystemOfRecordStore
  - analysis run
  - artifact
  - entity
  - dependency
  - evidence
  - coverage

SearchStore
  - full-text source search
  - fuzzy entity lookup
  - indexed evidence search
  - 필요할 경우 이후 semantic retrieval
```

SQLite, PostgreSQL, MySQL, MariaDB는 system of record에 잘 맞는다. Elasticsearch는 search에 잘 맞는다. MongoDB는 document-shaped analysis artifact에는 유용할 수 있지만, graph traversal과 relational integrity는 별도 설계가 필요하다.

## LangGraph 유사 Orchestration 상태

LangGraph와 유사한 workflow 구조는 아직 확정된 제품 요구사항이 아니다.

현재 단계에서는 graph workflow가 어떤 사용자 가치나 운영 목적을 달성해야 하는지 결정되지 않았다. 따라서 backend는 너무 이른 시점에 무거운 agent framework에 묶이지 않아야 한다.

가까운 기본값은 나중에 교체하거나 확장할 수 있는 작고 명시적인 workflow/state-machine layer다.

가능한 구현 형태:

```clojure
{:run-id "..."
 :status :running
 :current-node :normalize
 :checkpoint {...}
 :artifacts [...]
 :warnings []
 :errors []
 :retry-count 0}
```

각 node는 state map을 받아 새 state map을 반환한다:

```clojure
(defn normalize-node [state]
  (-> state
      (assoc :normalized-ir (normalize (:analysis state)))
      (assoc :current-node :persist)))
```

## LangGraph 유사 구조의 잠재 사용처

아래 항목은 예시일 뿐이며 확정된 제품 요구사항이 아니다.

- **Analysis pipeline orchestration**
  - repository file discovery
  - artifact classification
  - 하나 이상의 analyzer 실행
  - analyzer output을 IR로 normalize
  - entity, relation, evidence, coverage 저장
  - verified graph view 생성

- **Multi-analyzer agreement workflow**
  - TypeScript fallback analyzer 실행
  - 호환 가능할 때 `cobol-intel` 실행
  - entity와 relation 비교
  - analyzer가 동의하면 confidence 상향
  - analyzer가 불일치하면 confidence 하향 또는 review-needed 표시

- **Ask AI context builder**
  - 사용자 질문 파악
  - 관련 entity 식별
  - verified graph neighborhood 탐색
  - source evidence 검색
  - Gemini prompt를 bounded context로 구성
  - 답변이 알려진 evidence를 인용하는지 검증

- **Impact analysis workflow**
  - program, copybook, field, transaction, JCL job, dataset 중 하나에서 시작
  - upstream/downstream dependency traversal
  - 예상 business impact ranking
  - graph node, edge, source evidence 반환

- **Human review workflow**
  - unresolved reference 또는 low-confidence relation 표시
  - 사용자 검토를 위해 run pause
  - 사용자가 candidate relation을 승인/거절하면 resume

- **Long-running analysis control**
  - 비용이 큰 step 이후 checkpoint 저장
  - 실패 node retry
  - process restart 이후 resume
  - UI에 progress report
  - 특정 node가 병목이 될 때 backpressure 적용

## Clojure가 이 경계에 맞는 이유

Clojure는 이 backend에 잘 맞는다. 이 문제의 중심이 data transformation, graph traversal, controlled orchestration이기 때문이다.

언어적 장점:

- map, vector, set, EDN 중심의 data-first modeling
- replay 가능한 workflow를 만들기 쉬운 immutable state transition
- CardDemo 분석 규칙을 빠르게 실험할 수 있는 REPL-driven development
- adapter와 artifact별 동작을 나누기 좋은 protocol/multimethod
- DB, AWS SDK, observability, deployment tooling을 활용하기 좋은 JVM interoperability
- 필요할 경우 Python 기반 analyzer library를 감싸기 위한 Python interoperability 가능성
- workflow node input/output 검증에 Malli 같은 schema library 활용 가능

병목과 상태 제어 측면에서는 각 workflow step을 순수하거나 거의 순수한 state transition으로 모델링하고, step 사이에 checkpoint를 저장할 수 있다. 이 방식은 오래 걸리는 분석 job을 pause, retry, resume, inspect하기 쉽게 만든다.

단, durable execution에는 persistence가 필요하다. Clojure 언어 기능만으로 durable workflow system을 대체할 수는 없다. process나 instance failure 이후에도 안정적으로 이어가야 한다면 checkpoint state를 persistence adapter를 통해 저장하거나, 이후 Temporal 같은 workflow engine을 평가해야 한다.

## 평가할 Clojure 라이브러리

현재 시점에서 Mastra를 1:1로 대체하는 단일 Clojure framework가 있다고 가정하지 않는다.

후보 영역:

- **Maestro**
  - Clojure/ClojureScript용 state machine runner
  - state map 위의 명시적 workflow graph에 적합

- **Mycelium**
  - LLM agent orchestration을 위한 schema-enforced workflow component로 소개됨
  - Malli-style validation을 가진 graph-shaped LLM workflow에 관련 있음

- **Bosquet**
  - prompt composition, graph processing, tool, memory, cache를 제공하는 LLMOps 성격의 Clojure library
  - Ask AI가 단순 prompt construction을 넘어설 경우 관련 있음

- **instructor-clj**
  - Malli schema 기반 structured LLM output
  - Gemini 등 LLM response validation에 관련 있음

- **DSCloj**
  - declarative LLM pipeline programming
  - AI workflow가 더 typed/compositional해질 경우 관련 있음

이들은 도입 전에 프로젝트 요구에 맞게 benchmark해야 한다.

## 제안하는 첫 구현 단위

1. health/version endpoint를 가진 Clojure service skeleton 추가
2. analysis run, graph query, evidence lookup API contract 정의
3. normalized IR schema 정의
4. `AnalysisStore` 정의 후 SQLite 구현체 먼저 추가
5. analysis run state를 Clojure API 뒤로 이동
6. Next.js가 Clojure API만 호출하도록 변경
7. local/private AWS instance 배포용 Docker와 shell script 추가
8. 첫 non-SQLite adapter로 PostgreSQL 평가
9. custom state machine, Maestro, Mycelium, Bosquet, Temporal 중 무엇이 필요한지 평가

## 열린 질문

- 어떤 Clojure web stack을 사용할 것인가?
- PostgreSQL 지원 이후에도 SQLite를 local default로 유지할 것인가?
- DB migration을 처음부터 Clojure가 소유할 것인가?
- analysis를 Next.js 밖으로 옮기기 전에 필요한 최소 IR schema는 무엇인가?
- LangGraph 유사 orchestration을 정당화할 운영상 또는 제품상 필요는 무엇인가?
- long-running analysis에는 in-process state machine, queue worker, external durable workflow engine 중 무엇이 적합한가?
- Elasticsearch는 source/evidence search에만 도입할 것인가, analysis result exploration에도 사용할 것인가?
