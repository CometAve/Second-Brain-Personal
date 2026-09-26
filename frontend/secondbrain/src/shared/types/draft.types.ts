/**
 * Draft 도메인 타입 정의
 * - 백엔드 NoteDraft.java와 1:1 매칭
 * - Redis 기반 임시 저장 타입
 */

/**
 * Draft 도메인 모델
 * - noteId: UUID (클라이언트 생성)
 * - userId: 사용자 ID (서버 자동 할당)
 * - title: 노트 제목
 * - content: 노트 본문 (TEXT)
 * - version: Optimistic Locking용 버전 번호
 * - lastModified: 최종 수정 시간 (ISO 8601)
 */
export interface NoteDraft {
  noteId: string;
  userId: number;
  title: string;
  content: string;
  version: number;
  lastModified: string;
}

/**
 * Draft 저장 요청 DTO
 * - POST /api/drafts
 * - noteId: 클라이언트가 생성한 UUID (선택, 없으면 서버 생성)
 * - title, content: 선택 (title OR content 중 하나만 있어도 저장 가능)
 * - version: Optimistic Locking용 (충돌 감지)
 */
export interface NoteDraftRequest {
  noteId?: string;
  title?: string;
  content?: string;
  version: number;
}

/**
 * Draft 응답 DTO
 * - GET /api/drafts/{noteId}
 * - POST /api/drafts (저장 후 응답)
 */
export interface NoteDraftResponse {
  noteId: string;
  title: string;
  content: string;
  version: number;
  lastModified: string;
}

/**
 * Draft 목록 응답 DTO
 * - GET /api/drafts
 */
export interface NoteDraftListResponse {
  drafts: NoteDraftResponse[];
  totalCount: number;
}

/**
 * Delta Operation (미래 확장용)
 * - Phase 3: Delta Sync 구현 시 사용
 */
export interface DeltaOperation {
  type: 'INSERT' | 'DELETE' | 'REPLACE';
  position: number;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}
