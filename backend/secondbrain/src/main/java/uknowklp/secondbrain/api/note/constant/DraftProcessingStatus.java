package uknowklp.secondbrain.api.note.constant;

/**
 * Draft 처리 상태 상수
 *
 * Redis processed:draft:{uuid} 키의 값으로 사용
 * - PROCESSING: 처리 중
 * - 숫자 문자열: DB Note ID (처리 완료)
 */
public final class DraftProcessingStatus {

	/**
	 * 처리 중 상태
	 */
	public static final String PROCESSING = "PROCESSING";

	/**
	 * DB Note ID 패턴 (숫자만)
	 */
	public static final String DB_NOTE_ID_PATTERN = "^\\d+$";

	// Utility class - 인스턴스화 방지
	private DraftProcessingStatus() {
		throw new AssertionError("Utility class should not be instantiated");
	}

	/**
	 * 처리 중 상태인지 확인
	 *
	 * @param status 처리 상태 값
	 * @return 처리 중 여부
	 */
	public static boolean isProcessing(String status) {
		return PROCESSING.equals(status) || (status != null && status.startsWith(PROCESSING + ":"));
	}

	/**
	 * DB Note ID 형식인지 검증
	 *
	 * @param status 처리 상태 값
	 * @return DB Note ID 형식 여부
	 */
	public static boolean isDbNoteId(String status) {
		return status != null && status.matches(DB_NOTE_ID_PATTERN);
	}

	/**
	 * DB Note ID 파싱 (안전)
	 *
	 * @param status 처리 상태 값
	 * @return DB Note ID (Long)
	 * @throws NumberFormatException 파싱 실패 시
	 */
	public static Long parseDbNoteId(String status) throws NumberFormatException {
		if (!isDbNoteId(status)) {
			throw new NumberFormatException("Invalid DB Note ID format: " + status);
		}
		return Long.parseLong(status);
	}
}
