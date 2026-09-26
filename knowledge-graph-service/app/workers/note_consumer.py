"""
노트 이벤트 소비자 (Worker)

이 워커는 RabbitMQ에서 노트 관련 이벤트 메시지를 수신하고 처리합니다.

메시지 플로우:
1. Spring Boot → RabbitMQ (메시지 발행)
2. RabbitMQ → 워커 (메시지 수신)
3. 워커 → Google Cloud Gemini (임베딩 생성)
4. 워커 → Neo4j (노트 저장 및 관계 생성)

처리 이벤트:
- note.created: 노트 생성 시 임베딩 생성 및 저장
- note.updated: 노트 수정 시 임베딩 재생성 및 관계 재설정
- note.deleted: 노트 삭제 시 Neo4j에서 제거
"""

import json
import logging
from typing import Optional

from app.services.rabbitmq_service import rabbitmq_service
from app.core.config import get_settings
from app.services.embedding_service import embedding_service
from app.services.similarity_service import similarity_service
from app.crud import note as note_crud
from app.schemas.event import (
    NoteCreatedEvent,
    NoteUpdatedEvent,
    NoteDeletedEvent,
    EventType,
)

logger = logging.getLogger(__name__)

MAX_RETRIES = 5



def process_note_created(
    ch,
    method,
    properties,
    body,
):
    """
    노트 생성 이벤트 처리

    역할:
    1. 노트 내용 임베딩 생성
    2. Neo4j에 노트 저장(노드)
    3. 관계 생성

    메시지 구조:
    {
        "event_type": "note.created",
        "note_id": "550e8400-e29b-41d4-a716-446655440000",
        "user_id": "user-123",
        "title": "Python 기초",
        "content": "Python은 읽기 쉬운..."
    }

    에러 처리:
    - 임베딩/Neo4j 실패: nack + requeue, 소비자 중지
    """
    try:
        logger.debug(f"이벤트 수신")
        # 1. 파싱
        event_data = json.loads(body)
        event = NoteCreatedEvent(**event_data)
        logger.debug(f"파싱 완료")
        # 2. 임베딩 생성
        embedding, token_count = embedding_service.generate_embedding(
            event.content, title=event.title
        )

        if not embedding:
            raise Exception("임베딩 생성 실패")
        logger.debug(f"임베딩 생성 완료")

        # 3. Neo4j 노트 저장
        note_crud.create_note(
            user_id=event.user_id,
            note_id=event.note_id,
            title=event.title,
            embedding=embedding,
            embedding_model=embedding_service.model_tag,
        )
        logger.debug("노트 저장 완료")

        # 4. 유사도 기반 관계 생성
        relationships = similarity_service.create_similarity_relationships(
            user_id=event.user_id,
            note_id=event.note_id,
            embedding=embedding,
        )
        logger.debug(f"유사도 관계 형성 완료 : {relationships}개")

        # 5. 메시지 확인
        ch.basic_ack(delivery_tag=method.delivery_tag)
        logger.debug("생성 메시지 처리 완료")

    except Exception as e:
        logger.error(f"❌ 노트 생성 처리 실패 - {e}")
        raise


def process_note_updated(
    ch,
    method,
    properties,
    body,
):
    """
    노트 수정 이벤트 처리

    노트가 수정되면:
    1. content가 변경되었으면 임베딩 재생성
    2. Neo4j에서 노트 업데이트
    3. 기존 유사도 관계 제거
    4. 새로운 유사도 관계 생성

    메시지 구조:
    {
        "event_type": "note.updated",
        "note_id": "550e8400-e29b-41d4-a716-446655440000",
        "user_id": "user-123",
        "title": "Python 심화",  // 선택사항
        "content": "..."         // 선택사항
    }

    처리 로직:
    - title만 변경: 제목만 업데이트 (관계 유지)
    - content 변경: 임베딩 재생성 + 관계 재설정
    - 둘 다 변경: 임베딩 재생성 + 관계 재설정
    """
    try:
        logger.debug(f"노트 수정 이벤트 수신")
        # 1. 파싱
        event_data = json.loads(body)
        event = NoteUpdatedEvent(**event_data)
        logger.debug(f"파싱 완료")
        # 2. 임베딩 재생성(content 변경사항이 있을 때)
        new_embedding: Optional[list] = None
        if event.content is not None:
            current_note = note_crud.get_note(event.user_id, event.note_id)
            if current_note is None:
                raise ValueError("임베딩을 갱신할 노트를 찾을 수 없습니다")
            new_embedding, token_count = embedding_service.generate_embedding(
                event.content, title=event.title or current_note["title"]
            )
            if not new_embedding:
                raise Exception("임베딩 생성 실패")
            logger.debug(f"임베딩 생성 완료")
        # 3. Neo4j 업데이트
        updated = note_crud.update_note(
            user_id=event.user_id,
            note_id=event.note_id,
            title=event.title,
            embedding=new_embedding,
            embedding_model=embedding_service.model_tag if new_embedding is not None else None,
        )
        if not updated:
            raise ValueError("갱신할 노트를 찾을 수 없습니다")

        # 4. 관계 업데이트(content 변경사항이 있을 때)
        if event.content is not None:
            note_crud.delete_relationships(event.user_id, event.note_id)
            logger.debug(f"기존 관계 제거 완료")

            relationships = similarity_service.create_similarity_relationships(
                user_id=event.user_id,
                note_id=event.note_id,
                embedding=new_embedding,
            )
            logger.debug(f"유사도 관계 형성 완료 : {relationships}개")

        ch.basic_ack(delivery_tag=method.delivery_tag)
        logger.debug("수정 메시지 처리 완료")

    except Exception as e:
        logger.error(f"❌ 노트 수정 처리 실패 - {e}")
        raise



def process_note_deleted(
    ch,
    method,
    properties,
    body,
):
    """
    노트 삭제 이벤트 처리

    노트가 삭제되면:
    1. Neo4j에서 노트 노드 삭제
    2. 관련된 모든 관계(SIMILAR_TO) 자동 삭제

    메시지 구조:
    {
        "event_type": "note.deleted",
        "note_id": "550e8400-e29b-41d4-a716-446655440000",
        "user_id": "user-123"
    }

    처리 로직:
    - Neo4j에서 노드 삭제 (관계는 자동 삭제)
    """
    try:
        logger.debug(f"노트 삭제 이벤트 수신")
        # 1. 파싱
        event_data = json.loads(body)
        event = NoteDeletedEvent(**event_data)
        logger.debug(f"파싱 완료")

        # 2. Neo4j에서 노트 삭제
        note_crud.delete_note(
            user_id=event.user_id,
            note_id=event.note_id,
        )
        logger.debug("노트 삭제 완료")

        # 3. 메시지 확인
        ch.basic_ack(delivery_tag=method.delivery_tag)
        logger.debug("삭제 메시지 처리 완료")

    except Exception as e:
        logger.error(f"❌ 노트 삭제 처리 실패 - {e}")
        raise



def message_router(
    ch,
    method,
    properties,
    body,
):
    """
    메시지 라우터

    event_type에 따라 적절한 처리 함수로 라우팅합니다.

    라우팅:
    - "note.created" → process_note_created()
    - "note.updated" → process_note_updated()
    - "note.deleted" → process_note_deleted()
    - 기타 → 오류 처리
    """
    try:
        event_data = json.loads(body)
        event_type = event_data.get("event_type")

        if event_type == EventType.NOTE_CREATED.value:
            process_note_created(ch, method, properties, body)
        elif event_type == EventType.NOTE_UPDATED.value:
            process_note_updated(ch, method, properties, body)
        elif event_type == EventType.NOTE_DELETED.value:
            process_note_deleted(ch, method, properties, body)
        else:
            raise ValueError(f"알 수 없는 이벤트 타입: {event_type}")

    except Exception as e:
        logger.error(f"❌ 메시지 라우팅 실패: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
        ch.stop_consuming()
        raise


def start_consumer():
    """
    워커 시작

    RabbitMQ에 연결하고 메시지 수신을 시작합니다.

    설정:
    - Exchange: "knowledge_graph_events" (Topic)
    - Queue: "note_creation_queue"
    - Routing key: "note.*" (note.created, note.updated, note.deleted)

    실행:
    1. RabbitMQ 연결
    2. Exchange, Queue, Binding 선언
    3. 메시지 수신 대기 (무한 루프)

    종료:
    - Ctrl+C: 정상 종료
    - 예외 발생: 오류 로그 후 종료
    """
    try:
        logger.debug("워커 시작 중...")
        # 1. 연결
        if not rabbitmq_service.connect():
            raise Exception("RabbitMQ 연결 실패")
        logger.debug("RabbitMQ 연결 성공")

        # 2. Exchange, Queue, Binding 선언
        if not rabbitmq_service.declare_exchange_and_queue(
            exchange_name="knowledge_graph_events",
            queue_name=get_settings().rabbitmq_queue,
            routing_key="note.*",
        ):
            raise Exception("Exchange/Queue 선언 실패")
        logger.debug("Exchange/Queue 선언 성공")

        rabbitmq_service.consume_messages(
            queue_name=get_settings().rabbitmq_queue,
            callback=message_router,
        )
    except KeyboardInterrupt:
        logger.info("워커 종료 중... (사용자 중단)")
        rabbitmq_service.close()
    except Exception as e:
        logger.error(f"❌ 워커 종료 중 오류 발생: {e}")
        rabbitmq_service.close()
        raise

if __name__ == "__main__":
    start_consumer()
