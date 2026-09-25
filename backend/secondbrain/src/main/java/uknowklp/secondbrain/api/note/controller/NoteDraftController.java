package uknowklp.secondbrain.api.note.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uknowklp.secondbrain.api.note.domain.NoteDraft;
import uknowklp.secondbrain.api.note.dto.NoteDraftListResponse;
import uknowklp.secondbrain.api.note.dto.NoteDraftRequest;
import uknowklp.secondbrain.api.note.dto.NoteDraftResponse;
import uknowklp.secondbrain.api.note.service.NoteDraftService;
import uknowklp.secondbrain.api.user.domain.User;
import uknowklp.secondbrain.global.response.BaseResponse;
import uknowklp.secondbrain.global.response.BaseResponseStatus;
import uknowklp.secondbrain.global.security.jwt.dto.CustomUserDetails;

/**
 * 노트 Draft REST API 컨트롤러
 *
 * Redis Write-Behind 패턴 (자동 저장):
 * - POST /api/drafts → Draft 저장 (Debouncing 후)
 * - GET /api/drafts → Draft 목록 조회
 * - GET /api/drafts/{noteId} → Draft 조회
 * - DELETE /api/drafts/{noteId} → Draft 삭제
 *
 * 자동 저장 트리거:
 * 1. 타이핑 → Debouncing 500ms → Redis 저장
 * 2. 50회 변경 or 5분 경과 → DB 저장 (프론트엔드)
 * 3. 페이지 이탈 → DB 저장 (beforeunload)
 * 4. Side Peek 닫기 → DB 저장
 * 5. 백엔드 스케줄러 (5분) → DB 저장
 */
@Slf4j
@RestController
@RequestMapping("/api/drafts")
@RequiredArgsConstructor
@Tag(name = "Note Draft", description = "노트 임시 저장 API (자동 저장)")
public class NoteDraftController {

	private final NoteDraftService noteDraftService;

	/**
	 * Draft 저장 (Auto-save)
	 *
	 * 프론트엔드 Debouncing 후 호출됨 (500ms)
	 * 검증: title 또는 content 중 하나라도 있으면 저장
	 *
	 * 성능 최적화 (v3):
	 * - Service에서 NoteDraft 객체 직접 반환받아 Redis 재조회 제거
	 * - Redis 네트워크 호출 감소 (2회 → 1회)
	 * - 자동 저장 빈번한 호출 시 누적 성능 향상
	 *
	 * @param userDetails 인증된 사용자 정보
	 * @param request     Draft 요청 (title, content, version)
	 * @return 저장된 Draft 정보 (version 포함)
	 */
	@PostMapping
	@Operation(summary = "Draft 저장", description = "노트 임시 저장 (Auto-save)")
	public ResponseEntity<BaseResponse<NoteDraftResponse>> saveDraft(
		@AuthenticationPrincipal CustomUserDetails userDetails,
		@Valid @RequestBody NoteDraftRequest request) {

		User user = userDetails.getUser();
		log.info("Draft 저장 요청 - UserId: {}, NoteId: {}",
			user.getId(), request.getNoteId());

		// NoteDraft 객체 직접 반환받음 (Redis 1회 호출)
		NoteDraft draft = noteDraftService.saveDraft(user.getId(), request);
		NoteDraftResponse draftResponse = NoteDraftResponse.from(draft);

		BaseResponse<NoteDraftResponse> response = new BaseResponse<>(draftResponse);
		return ResponseEntity.status(HttpStatus.CREATED).body(response);
	}

	/**
	 * Draft 목록 조회
	 *
	 * 사용자의 모든 Draft 조회 (브라우저 재시작 후 복구용)
	 *
	 * @param userDetails 인증된 사용자 정보
	 * @return Draft 목록
	 */
	@GetMapping
	@Operation(summary = "Draft 목록 조회", description = "사용자의 모든 Draft 조회")
	public ResponseEntity<BaseResponse<NoteDraftListResponse>> listDrafts(
		@AuthenticationPrincipal CustomUserDetails userDetails) {

		User user = userDetails.getUser();
		log.info("Draft 목록 조회 요청 - UserId: {}", user.getId());

		List<NoteDraftResponse> drafts = noteDraftService.listUserDrafts(user.getId());

		NoteDraftListResponse response = NoteDraftListResponse.builder()
			.drafts(drafts)
			.totalCount(drafts.size())
			.build();

		return ResponseEntity.ok(new BaseResponse<>(response));
	}

	/**
	 * Draft 조회
	 *
	 * Side Peek 열릴 때 또는 페이지 로드 시 호출
	 *
	 * @param userDetails 인증된 사용자 정보
	 * @param noteId      노트 ID
	 * @return NoteDraftResponse
	 */
	@GetMapping("/{noteId}")
	@Operation(summary = "Draft 조회", description = "노트 임시 저장 데이터 조회")
	public ResponseEntity<BaseResponse<NoteDraftResponse>> getDraft(
		@AuthenticationPrincipal CustomUserDetails userDetails,
		@PathVariable String noteId) {

		User user = userDetails.getUser();
		log.info("Draft 조회 요청 - UserId: {}, NoteId: {}", user.getId(), noteId);

		NoteDraft draft = noteDraftService.getDraft(noteId, user.getId());
		NoteDraftResponse response = NoteDraftResponse.from(draft);

		return ResponseEntity.ok(new BaseResponse<>(response));
	}

	/**
	 * Draft 삭제
	 *
	 * DB 저장 후 또는 취소 시 호출
	 *
	 * @param userDetails 인증된 사용자 정보
	 * @param noteId      노트 ID
	 * @return 성공 응답
	 */
	@DeleteMapping("/{noteId}")
	@Operation(summary = "Draft 삭제", description = "노트 임시 저장 데이터 삭제")
	public ResponseEntity<BaseResponse<Void>> deleteDraft(
		@AuthenticationPrincipal CustomUserDetails userDetails,
		@PathVariable String noteId) {

		User user = userDetails.getUser();
		log.info("Draft 삭제 요청 - UserId: {}, NoteId: {}", user.getId(), noteId);

		noteDraftService.deleteDraft(noteId, user.getId(), true);

		return ResponseEntity.ok(new BaseResponse<>(BaseResponseStatus.SUCCESS));
	}
}
