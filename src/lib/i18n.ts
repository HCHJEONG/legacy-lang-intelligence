export const locales = ["en", "ko"] as const;
export type Locale = (typeof locales)[number];

export const messages = {
  en: { quality: "Analysis Quality", search: "Search Entities", map: "System Map", ask: "Ask AI", evidence: "Source Evidence", knownUnknowns: "Known Unknowns", confidence: "Overall confidence", good: "GOOD", partial: "PARTIAL", searchPlaceholder: "Program, copybook, dataset...", noDatabase: "No persisted analysis yet", runCommands: "Run npm run ingest and npm run persist to generate the local CardDemo SQLite database.", follow: "Follow relation", selectEntity: "Search and select an entity.", sourceHint: "Select an entity with verified relations to see source evidence.", language: "한국어", filter: "Filter", allNodes: "All node types", allConfidence: "All confidence", allRelations: "All relations", truncated: "truncated for readability", journey: "Search → Entity → Neighborhood → Relation → Source" },
  ko: { quality: "분석 품질", search: "Entity 검색", map: "System Map", ask: "Ask AI", evidence: "소스 근거", knownUnknowns: "확인되지 않은 영역", confidence: "전체 신뢰도", good: "양호", partial: "부분 확인", searchPlaceholder: "프로그램, copybook, dataset...", noDatabase: "저장된 분석 결과가 없습니다", runCommands: "npm run ingest와 npm run persist를 실행해 CardDemo SQLite 분석 결과를 생성하세요.", follow: "관계 따라가기", selectEntity: "Entity를 검색하고 선택하세요.", sourceHint: "검증된 관계가 있는 Entity를 선택하면 소스 근거가 표시됩니다.", language: "English", filter: "필터", allNodes: "모든 node 유형", allConfidence: "모든 신뢰도", allRelations: "모든 관계", truncated: "가독성을 위해 일부만 표시", journey: "검색 → Entity → Neighborhood → 관계 → 소스" },
} as const;

export type Messages = { [Key in keyof typeof messages.en]: string };

export function getLocale(value?: string): Locale { return value === "ko" ? "ko" : "en"; }
