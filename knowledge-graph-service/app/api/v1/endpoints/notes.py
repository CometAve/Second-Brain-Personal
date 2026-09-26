"""노트 CRUD 엔드포인트"""

from fastapi import APIRouter, Header, HTTPException, Query
import logging

from app.crud import note as note_crud
from app.schemas.note import (
    NoteCreate,
    NoteResponse,
    NoteListResponse,
    NoteDetailResponse,
    EmbeddingResponse,
)
from app.services.embedding_service import embedding_service
from app.services.similarity_service import similarity_service
from app.core.constants import NoteConfig, ErrorConfig
from app.api.v1.dependencies import get_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notes", tags=["notes"])


# ===== 노트 생성 =====
@router.post(
    "",
    response_model=EmbeddingResponse,
    summary="노트 생성",
    description="새로운 노트를 생성하고 임베딩을 생성한 후 유사 노트와 연결합니다",
)
async def create_note(
    note: NoteCreate,
    x_user_id: int = Header(..., alias="X-User-ID"),
) -> EmbeddingResponse:
    """
    노트 생성 API

    **요청:**
    - X-User-ID: 사용자 ID (Header)
    - Body: NoteCreate (note_id, title, content)

    **응답:**
    - EmbeddingResponse (note_id, embedding_dimension, linked_notes_count)

    **흐름:**
    1. content로 임베딩 생성
    2. Neo4j에 노트 저장
    3. 유사 노트 검색 및 관계 생성
    """
    try:
        user_id = get_user_id(x_user_id)

        logger.debug(f"📝 노트 생성 시작: {user_id} - {note.title[:20]}...")

        # 1. 임베딩 생성
        logger.debug("🤖 임베딩 생성 중...")
        embedding, token_count = embedding_service.generate_embedding(
            note.content, title=note.title
        )

        logger.debug(f"   ✅ 임베딩 생성 완료: {len(embedding)}차원, {token_count}토큰")

        # 2. Neo4j에 노트 저장
        logger.debug("💾 Neo4j에 노트 저장 중...")
        note_id = note_crud.create_note(
            note_id=note.note_id,
            user_id=user_id,
            title=note.title,
            embedding=embedding,
            embedding_model=embedding_service.model_tag,
        )

        logger.debug(f"   ✅ 노트 저장 완료: {note_id}")

        # 3. 유사 노트 찾기 및 관계 생성
        logger.debug("🔗 유사 노트 연결 중...")
        linked_count = similarity_service.create_similarity_relationships(
            user_id=user_id,
            note_id=note_id,
            embedding=embedding,
        )

        logger.debug(f"✅ 노트 생성 완료: {note_id} ({linked_count}개 노트 연결)")

        return EmbeddingResponse(
            note_id=note_id,
            user_id=user_id,
            embedding_dimension=len(embedding),
            linked_notes_count=linked_count,
        )

    except Exception as e:
        logger.error(f"❌ 노트 생성 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== 노트 목록 조회 =====
@router.get(
    "",
    response_model=NoteListResponse,
    summary="노트 목록 조회",
    description="사용자의 모든 노트를 페이지네이션으로 조회합니다",
)
async def list_notes(
    x_user_id: int = Header(..., alias="X-User-ID"),
    limit: int = Query(
        default=NoteConfig.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=NoteConfig.MAX_PAGE_LIMIT,
        description="최대 개수",
    ),
    skip: int = Query(
        default=0,
        ge=0,
        description="건너뛸 개수",
    ),
) -> NoteListResponse:
    """
    노트 목록 조회 API (페이지네이션)

    **쿼리 파라미터:**
    - limit: 최대 개수 (기본: 20, 최대: 100)
    - skip: 건너뛸 개수 (기본: 0)

    **응답:**
    - NoteListResponse (notes, total, limit, skip)
    """
    try:
        user_id = get_user_id(x_user_id)

        logger.debug(f"📚 노트 목록 조회: {user_id} (limit={limit}, skip={skip})")

        # 노트 목록 조회
        notes, total = note_crud.get_all_notes(
            user_id=user_id,
            limit=limit,
            skip=skip,
        )

        logger.debug(f"✅ 노트 목록 조회 완료: {len(notes)}개 (전체: {total}개)")

        return NoteListResponse(
            user_id=user_id,
            notes=notes,
            total=total,
            limit=limit,
            skip=skip,
        )

    except Exception as e:
        logger.error(f"❌ 노트 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== 노트 조회 =====
@router.get(
    "/{note_id}",
    response_model=NoteDetailResponse,
    summary="노트 상세 조회",
    description="노트 정보와 유사한 노트들을 함께 조회합니다",
)
async def get_note(
    note_id: int,
    x_user_id: int = Header(..., alias="X-User-ID"),
) -> NoteDetailResponse:
    """
    노트 상세 조회 API

    **경로 파라미터:**
    - note_id: 노트 ID

    **응답:**
    - NoteDetailResponse (note_id, title, created_at, similar_notes)
    """
    try:
        user_id = get_user_id(x_user_id)

        logger.debug(f"📖 노트 조회: {user_id} - {note_id}")

        # 1. 노트 조회
        note = note_crud.get_note(user_id=user_id, note_id=note_id)

        if not note:
            logger.warning(f"⚠️  노트 없음: {note_id}")
            raise HTTPException(
                status_code=404,
                detail=ErrorConfig.NOTE_NOT_FOUND,
            )

        # 2. 유사 노트 조회
        similar_notes = note_crud.get_similar_notes(
            user_id=user_id,
            note_id=note_id,
        )

        logger.debug(f"✅ 노트 조회 완료: {note_id} (유사 노트: {len(similar_notes)}개)")

        return NoteDetailResponse(
            **note,
            similar_notes=similar_notes,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 노트 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== 노트 삭제 =====
@router.delete(
    "/{note_id}",
    summary="노트 삭제",
    description="노트와 연결된 관계를 모두 삭제합니다",
)
async def delete_note(
    note_id: int,
    x_user_id: int = Header(..., alias="X-User-ID"),
) -> dict:
    """
    노트 삭제 API

    **경로 파라미터:**
    - note_id: 노트 ID

    **응답:**
    - {status: "success", message: "..."}
    """
    try:
        user_id = get_user_id(x_user_id)

        logger.debug(f"🗑️  노트 삭제: {user_id} - {note_id}")

        # 1. 관계 삭제
        similarity_service.delete_similarity_relationships(
            user_id=user_id,
            note_id=note_id,
        )

        # 2. 노트 삭제
        deleted = note_crud.delete_note(user_id=user_id, note_id=note_id)

        if not deleted:
            raise HTTPException(
                status_code=404,
                detail=ErrorConfig.NOTE_NOT_FOUND,
            )

        logger.debug(f"✅ 노트 삭제 완료: {note_id}")

        return {
            "status": "success",
            "message": f"노트 {note_id}가 삭제되었습니다",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 노트 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))
