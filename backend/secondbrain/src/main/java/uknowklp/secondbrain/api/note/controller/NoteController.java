package uknowklp.secondbrain.api.note.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uknowklp.secondbrain.api.note.domain.Note;
import uknowklp.secondbrain.api.note.dto.NoteDeleteRequest;
import uknowklp.secondbrain.api.note.dto.NoteGraphNodeResponse;
import uknowklp.secondbrain.api.note.dto.NoteRecentResponse;
import uknowklp.secondbrain.api.note.dto.NoteReminderResponse;
import uknowklp.secondbrain.api.note.dto.NoteRequest;
import uknowklp.secondbrain.api.note.dto.NoteResponse;
import uknowklp.secondbrain.api.note.service.NoteDraftPromotionService;
import uknowklp.secondbrain.api.note.service.NoteService;
import uknowklp.secondbrain.api.user.domain.User;
import uknowklp.secondbrain.global.response.BaseResponse;
import uknowklp.secondbrain.global.response.BaseResponseStatus;
import uknowklp.secondbrain.global.security.jwt.dto.CustomUserDetails;

/**
 * 노트 관련 REST API 컨트롤러
 */
@Slf4j
@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
public class NoteController {

	private final NoteService noteService;
	private final NoteDraftPromotionService noteDraftPromotionService;

	// 노트 생성
	@PostMapping
	@Operation(summary = "노트 생성", description = "새로운 노트를 생성합니다")
	public ResponseEntity<BaseResponse<Void>> createNote(
		@AuthenticationPrincipal CustomUserDetails userDetails,
		@Valid @RequestBody NoteRequest request) {

		User user = userDetails.getUser();
		log.info("Creating note for userId: {} - Title: {}, Content length: {}",
			user.getId(), request.getTitle(), request.getContent().length());

		noteService.createNote(user.getId(), request);

		BaseResponse<Void> response = new BaseResponse<>(BaseResponseStatus.CREATED);
		return ResponseEntity.status(HttpStatus.CREATED).body(response);
	}

	// 노트 조회
	@GetMapping("/{noteId}")
	@Operation(summary = "노트 조회", description = "노트 ID로 특정 노트의 상세 정보를 조회합니다")
	public ResponseEntity<BaseResponse<NoteResponse>> getNote(
		@AuthenticationPrincipal CustomUserDetails userDetails,
		@PathVariable Long noteId) {

		User user = userDetails.getUser();
		log.info("Getting note for userId: {} - NoteId: {}", user.getId(), noteId);

		// Service에서 노트 조회 (권한 검증 포함)
		NoteResponse noteResponse = noteService.getNoteById(noteId, user.getId());

		// 200 OK 응답 생성 및 반환
		BaseResponse<NoteResponse> response = new BaseResponse<>(noteResponse);
		return ResponseEntity.ok(response);
	}

	// 노트 수정
	@PutMapping("/{noteId}")
	@Operation(summary = "노트 수정", description = "기존 노트의 제목과 내용을 수정합니다")
	public ResponseEntity<BaseResponse<NoteResponse>> updateNote(
		@AuthenticationPrincipal CustomUserDetails userDetails,
		@PathVariable Long noteId,
		@Valid @RequestBody NoteRequest request) {

		User user = userDetails.getUser();
		log.info("Updating note for userId: {} - NoteId: {}, Title: {}, Content length: {}",
			user.getId(), noteId, request.getTitle(), request.getContent().length());

		NoteResponse noteResponse = noteService.updateNote(noteId, user.getId(), request);

		BaseResponse<NoteResponse> response = new BaseResponse<>(noteResponse);
		return ResponseEntity.ok(response);
	}

	// 노트 삭제 (단일 및 다중 삭제 지원)
	@DeleteMapping
	@Operation(summary = "노트 삭제", description = "노트를 삭제합니다 (단일 및 다중 삭제 지원)")
	public ResponseEntity<BaseResponse<Void>> deleteNotes(
		@AuthenticationPrincipal CustomUserDetails userDetails,
		@Valid @RequestBody NoteDeleteRequest request) {

		User user = userDetails.getUser();
		log.info("Deleting notes for userId: {} - Note count: {}", user.getId(), request.getNoteIds().size());

		noteService.deleteNotes(request.getNoteIds(), user.getId());

		BaseResponse<Void> response = new BaseResponse<>(BaseResponseStatus.SUCCESS);
		return ResponseEntity.ok(response);
	}

	@PostMapping("/{noteId}/reminders")
	@Operation(summary = "개별 노트 리마인더 활성화", description = "망각 곡선 기반 3회 리마인더 발송")
	public BaseResponse<Void> enableNoteReminder(
		@PathVariable Long noteId,
		@AuthenticationPrincipal CustomUserDetails userDetails
	) {
		noteService.enableNoteReminder(noteId, userDetails.getUser().getId());
		return new BaseResponse<>(BaseResponseStatus.SUCCESS);
	}

	@DeleteMapping("/{noteId}/reminders")
	@Operation(summary = "개별 노트 리마인더 비활성화", description = "해당 노트 리마인더 중단하고 리마인드 횟수 0으로 초기화")
	public BaseResponse<Void> disableNoteReminder(
		@PathVariable Long noteId,
		@AuthenticationPrincipal CustomUserDetails userDetails
	) {
		noteService.disableNoteReminder(noteId, userDetails.getUser().getId());
		return new BaseResponse<>(BaseResponseStatus.SUCCESS);
	}

	// 최근 노트 목록 조회 (상위 10개)
	@GetMapping("/recent")
	@Operation(summary = "최근 노트 목록 조회", description = "최근 수정된 노트 상위 10개를 조회합니다")
	public ResponseEntity<BaseResponse<List<NoteRecentResponse>>> getRecentNotes(
		@AuthenticationPrincipal CustomUserDetails userDetails) {

		User user = userDetails.getUser();
		log.info("Getting recent notes for userId: {}", user.getId());

		// Service에서 최근 노트 목록 조회
		List<NoteRecentResponse> recentNotes = noteService.getRecentNotes(user.getId());

		// 200 OK 응답 생성 및 반환 (data는 null 가능)
		BaseResponse<List<NoteRecentResponse>> response = new BaseResponse<>(recentNotes);
		return ResponseEntity.ok(response);
	}

	@GetMapping("/graph-nodes")
	@Operation(summary = "저장된 노트 그래프 노드 조회", description = "현재 사용자의 모든 저장된 노트 ID, 제목, 생성 시각을 조회합니다")
	public ResponseEntity<BaseResponse<List<NoteGraphNodeResponse>>> getGraphNodes(
		@AuthenticationPrincipal CustomUserDetails userDetails) {
		return ResponseEntity.ok(new BaseResponse<>(noteService.getGraphNodes(userDetails.getUser().getId())));
	}

	// 리마인더가 켜진 노트 목록 조회 (페이징 지원)
	@GetMapping("/reminders")
	@Operation(summary = "리마인더 활성화 노트 목록 조회", description = "리마인더가 켜진 노트 목록 조회 (무한스크롤 지원)")
	public ResponseEntity<BaseResponse<NoteReminderResponse>> getReminderNotes(
		@AuthenticationPrincipal CustomUserDetails userDetails,
		@RequestParam(defaultValue = "0") int page,
		@RequestParam(defaultValue = "10") int size) {

		User user = userDetails.getUser();
		log.info("Getting reminder notes for userId: {} - page: {}, size: {}", user.getId(), page, size);

		// Service에서 리마인더 노트 목록 조회
		NoteReminderResponse reminderNotes = noteService.getReminderNotes(user.getId(), page, size);

		// 200 OK 응답 생성 및 반환
		BaseResponse<NoteReminderResponse> response = new BaseResponse<>(reminderNotes);
		return ResponseEntity.ok(response);
	}

	/**
	 * Draft에서 노트 생성 (멱등성 보장)
	 *
	 * 안전성 개선:
	 * 1. 처리 상태 원자적 기록 (Redis Transaction)
	 * 2. 중복 요청 차단 (409 Conflict)
	 * 3. DB 저장 후 완료 상태 기록
	 * 4. Draft 삭제 실패 허용 (TTL로 자동 정리)
	 *
	 * 자동 저장 트리거:
	 * 1. 프론트엔드 Batching (50회 변경 or 5분 경과)
	 * 2. 페이지 이탈 (beforeunload)
	 * 3. Side Peek 닫기
	 * 4. 백엔드 스케줄러 (5분마다)
	 *
	 * @param userDetails 인증된 사용자 정보
	 * @param draftId     Draft UUID (String)
	 * @return 생성된 Note 정보
	 */
	@PostMapping("/from-draft/{draftId}")
	@Operation(summary = "Draft 자동 저장 (멱등성 보장)", description = "임시 저장된 Draft를 DB에 영구 저장")
	public ResponseEntity<BaseResponse<NoteResponse>> createNoteFromDraft(
		@AuthenticationPrincipal CustomUserDetails userDetails,
		@PathVariable String draftId) {
		NoteDraftPromotionService.Result result = noteDraftPromotionService.promote(
			draftId, userDetails.getUser().getId());
		return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK)
			.body(new BaseResponse<>(result.note()));
	}

}
