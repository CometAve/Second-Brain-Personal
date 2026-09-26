"""
애플리케이션 상수 및 기본값

"""


class NoteConfig:
    """노트 CRUD 관련 설정"""

    # === 유사도 검색 ===
    DEFAULT_SIMILARITY_LIMIT = 10  # get_similar_notes 기본값
    MAX_SIMILARITY_LIMIT = 50  # 상한선

    # === 페이지네이션 ===
    DEFAULT_PAGE_LIMIT = 20
    MAX_PAGE_LIMIT = 100

    # === 검색 ===
    DEFAULT_SEARCH_LIMIT = 20
    MAX_SEARCH_LIMIT = 100

    # === 콘텐츠 ===
    CONTENT_PREVIEW_LENGTH = 200

    # === 로깅 ===
    ENABLE_QUERY_LOGGING = True


class VectorConfig:
    """벡터 임베딩 관련 설정"""

    # === 임베딩 차원 ===
    EMBEDDING_DIMENSION = 1536  # gemini-embedding-2 출력 차원

    # === 벡터 인덱스 ===
    INDEX_NAME = "note_embeddings"  # Neo4j 벡터 인덱스명
    SIMILARITY_FUNCTION = "cosine"  # 코사인 유사도

    # === 검색 설정 ===
    VECTOR_SEARCH_LIMIT = 100  # 벡터 검색 시 가져올 최대 개수


class ValidationConfig:
    """검증 관련 설정"""

    # === 제목 검증 ===
    TITLE_MIN_LENGTH = 1
    TITLE_MAX_LENGTH = 500

    # === 내용 검증 ===
    CONTENT_MIN_LENGTH = 1

    # === 유사도 점수 검증 ===
    SIMILARITY_SCORE_MIN = 0.0
    SIMILARITY_SCORE_MAX = 1.0

    # === 페이지네이션 검증 ===
    LIMIT_MIN = 1
    LIMIT_MAX = 1000
    SKIP_MIN = 0


class ErrorConfig:
    """에러 메시지"""

    # === 노트 관련 ===
    NOTE_NOT_FOUND = "노트를 찾을 수 없습니다"
    NOTE_ALREADY_EXISTS = "이미 존재하는 노트입니다"

    # === 입력 검증 ===
    INVALID_LIMIT = "limit이 너무 큽니다"
    INVALID_SKIP = "skip은 0 이상이어야 합니다"
    INVALID_TITLE = "제목의 길이가 유효하지 않습니다"
    INVALID_CONTENT = "내용의 길이가 유효하지 않습니다"

    # === 임베딩 관련 ===
    EMBEDDING_FAILED = "임베딩 생성에 실패했습니다"
    EMBEDDING_NOT_FOUND = "임베딩을 찾을 수 없습니다"

    # === 데이터베이스 ===
    DATABASE_ERROR = "데이터베이스 오류가 발생했습니다"
    CONNECTION_ERROR = "데이터베이스 연결에 실패했습니다"


class LogConfig:
    """로깅 설정"""

    # === 로그 레벨 ===
    LEVEL_DEBUG = "DEBUG"
    LEVEL_INFO = "INFO"
    LEVEL_WARNING = "WARNING"
    LEVEL_ERROR = "ERROR"

    # === 로그 포맷 ===
    FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # === 로그 파일 ===
    LOG_FILE = "logs/app.log"
