package uknowklp.secondbrain.api.note.service;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;


import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uknowklp.secondbrain.api.note.domain.Note;
import uknowklp.secondbrain.api.note.domain.DraftPromotion;
import uknowklp.secondbrain.api.note.domain.NoteDocument;
import uknowklp.secondbrain.api.note.dto.KnowledgeGraphEvent;
import uknowklp.secondbrain.api.note.dto.NoteGraphNodeResponse;
import uknowklp.secondbrain.api.note.dto.NoteRecentResponse;
import uknowklp.secondbrain.api.note.dto.NoteReminderResponse;
import uknowklp.secondbrain.api.note.dto.NoteReminderResult;
import uknowklp.secondbrain.api.note.dto.NoteRequest;
import uknowklp.secondbrain.api.note.dto.NoteResponse;
import uknowklp.secondbrain.api.note.repository.NoteRepository;
import uknowklp.secondbrain.api.note.repository.DraftPromotionClaimWriter;
import uknowklp.secondbrain.api.user.domain.User;
import uknowklp.secondbrain.api.user.service.UserService;
import uknowklp.secondbrain.global.exception.BaseException;
import uknowklp.secondbrain.global.response.BaseResponseStatus;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class NoteServiceImpl implements NoteService {

	private final NoteRepository noteRepository;
	private final DraftPromotionClaimWriter draftPromotionClaimWriter;
	private final UserService userService;
	private final NoteSearchService noteSearchService;
	private final KnowledgeGraphProducerService knowledgeGraphProducerService;


	@Override
	public Note createNote(Long userId, NoteRequest request) {
		log.info("Creating note for user ID: {}", userId);

		// 요청 데이터 검증
		validateNoteRequest(request);

		// 사용자 존재 확인
		User user = userService.findById(userId)
			.orElseThrow(() -> new BaseException(BaseResponseStatus.USER_NOT_FOUND));

		// 서비스 레벨 검증: content 길이 확인
		validateContentLength(request.getContent());

		// 노트 생성
		Note note = Note.builder()
			.user(user)
			.title(request.getTitle())
			.content(request.getContent())
			.remindCount(0)
			.build();

		Note savedNote = noteRepository.save(note);
		log.info("노트 생성 완료 - 노트 ID: {}, 사용자 ID: {}", savedNote.getId(), userId);

		// Elasticsearch에 인덱싱
		try {
			NoteDocument noteDocument = NoteDocument.from(savedNote);
			noteSearchService.indexNote(noteDocument);
			log.info("Elasticsearch 인덱싱 완료 - 노트 ID: {}", savedNote.getId());
		} catch (Exception e) {
			log.error("Elasticsearch 인덱싱 실패 - 노트 ID: {}", savedNote.getId(), e);
			// Elasticsearch 인덱싱 실패는 메인 로직에 영향 없음
		}

		// 지식 그래프 created 이벤트 발행
		knowledgeGraphProducerService.publishNoteCreated(
			savedNote.getId(),
			userId,
			savedNote.getTitle(),
			savedNote.getContent()
		);

		return savedNote;
	}

	@Override
	public Note createNoteFromDraft(Long userId, String draftId, NoteRequest request) {
		// Claim the draft ID before creating any note or external index/event side effects.
		// A competing transaction blocks on this primary key, then fails before note creation.
		DraftPromotion promotion = draftPromotionClaimWriter.insert(draftId, userId);
		Note savedNote = createNote(userId, request);
		promotion.complete(savedNote.getId());
		draftPromotionClaimWriter.flush();
		return savedNote;
	}

	@Override
	public NoteResponse getNoteById(Long noteId, Long userId) {
		log.info("Getting note ID: {} for user ID: {}",noteId, userId);

		// 1. 노트 존재 여부 확인
		Note note = noteRepository.findById(noteId).orElseThrow(() -> new BaseException(BaseResponseStatus.NOTE_NOT_FOUND));

		// 2. 노트 소유자 확인 (권한 검증)
		if (!note.getUser().getId().equals(userId)) {
			log.warn("User {} tried to access note {} owned by user {}",
				userId, noteId, note.getUser().getId());
			throw new BaseException(BaseResponseStatus.NOTE_ACCESS_DENIED);
		}

		// 3. NoteResponse로 변환 후 반환
		log.info("Note found successfully - ID: {}, User ID: {}", noteId, userId);
		return NoteResponse.from(note);
	}

	@Override
	public NoteResponse updateNote(Long noteId, Long userId, NoteRequest request) {
		log.info("Updating note ID: {} for user ID: {}", noteId, userId);

		// 요청 데이터 검증
		validateNoteRequest(request);

		// 노트 존재 여부 확인
		Note note = noteRepository.findById(noteId)
			.orElseThrow(() -> new BaseException(BaseResponseStatus.NOTE_NOT_FOUND));

		// 권한 검증 (본인 노트만 수정 가능)
		if (!note.getUser().getId().equals(userId)) {
			log.warn("User {} tried to update note {} owned by user {}",
				userId, noteId, note.getUser().getId());
			throw new BaseException(BaseResponseStatus.NOTE_ACCESS_DENIED);
		}

		// 최종 content 길이 검증 (현재는 길이 제한 없음)
		validateContentLength(request.getContent());

		// 변경 전 값 저장 (지식 그래프 검증용)
		String oldTitle = note.getTitle();
		String oldContent = note.getContent();

		// 노트 수정 (updatedAt은 @UpdateTimestamp로 자동 갱신)
		note.update(request.getTitle(), request.getContent());

		// 변경사항 저장 (JPA dirty checking)
		Note updatedNote = noteRepository.save(note);
		log.info("노트 수정 완료 - 노트 ID: {}, 사용자 ID: {}", noteId, userId);

		// Elasticsearch 인덱스 업데이트
		try {
			NoteDocument noteDocument = NoteDocument.from(updatedNote);
			noteSearchService.indexNote(noteDocument);
			log.info("Elasticsearch 인덱스 업데이트 완료 - 노트 ID: {}", noteId);
		} catch (Exception e) {
			log.error("Elasticsearch 인덱스 업데이트 실패 - 노트 ID: {}", noteId, e);
		}

		// 지식 그래프 updated 이벤트 발행
		knowledgeGraphProducerService.publishNoteUpdated(
			updatedNote.getId(),
			userId,
			oldTitle,
			updatedNote.getTitle(),
			oldContent,
			updatedNote.getContent()
		);

		return NoteResponse.from(updatedNote);
	}

	@Override
	public void deleteNotes(List<Long> noteIds, Long userId) {
		log.info("Deleting {} notes for user ID: {}", noteIds.size(), userId);

		// 중복 ID 검증: UI에서 정상적으로 선택한 경우 중복이 없어야 함
		if (noteIds.size() != new HashSet<>(noteIds).size()) {
			log.warn("Duplicate note IDs detected in delete request - User ID: {}", userId);
			throw new BaseException(BaseResponseStatus.BAD_REQUEST);
		}

		// 1단계: 모든 노트를 한 번에 조회 (N+1 쿼리 방지)
		List<Note> notesToDelete = noteRepository.findAllById(noteIds);

		// 존재 여부 확인: 요청한 모든 노트가 존재하는지 검증
		if (notesToDelete.size() != noteIds.size()) {
			log.warn("Some notes not found during delete validation - Requested: {}, Found: {}",
				noteIds.size(), notesToDelete.size());
			throw new BaseException(BaseResponseStatus.NOTE_NOT_FOUND);
		}

		// 권한 검증: 모든 노트가 본인 소유인지 확인 (all-or-nothing 전략)
		for (Note note : notesToDelete) {
			if (!note.getUser().getId().equals(userId)) {
				log.warn("User {} tried to delete note {} owned by user {}",
					userId, note.getId(), note.getUser().getId());
				throw new BaseException(BaseResponseStatus.NOTE_ACCESS_DENIED);
			}
		}

		// 2단계: 모든 검증 통과 후 일괄 삭제
		noteRepository.deleteAll(notesToDelete);
		log.info("노트 삭제 완료 - 삭제된 노트 수: {}, 사용자 ID: {}", notesToDelete.size(), userId);

		// 3단계 : Elasticsearch 인덱스 삭제
		List<String> elasticNoteIds = notesToDelete.stream()
			.map(note -> note.getId().toString())
			.toList();

		try {
			noteSearchService.bulkDeleteNotes(elasticNoteIds);
			log.info("Elasticsearch bulk 삭제 완료 - 삭제된 노트 수: {}", elasticNoteIds.size());
		} catch (Exception e) {
			log.error("Elasticsearch bulk 삭제 실패", e);
		}

		// 지식 그래프 deleted 이벤트 발행
		for (Note note : notesToDelete) {
			knowledgeGraphProducerService.publishNoteDeleted(note.getId(), userId);
		}
	}

	private void validateNoteRequest(NoteRequest request) {
		// title 검증
		if (request.getTitle() == null || request.getTitle().trim().isEmpty()) {
			log.warn("Note title is empty");
			throw new BaseException(BaseResponseStatus.NOTE_TITLE_EMPTY);
		}
		if (request.getTitle().length() > 64) {
			log.warn("Note title too long: {} characters", request.getTitle().length());
			throw new BaseException(BaseResponseStatus.NOTE_TITLE_TOO_LONG);
		}

		// content 검증 (TEXT 타입으로 길이 제한 제거)
		if (request.getContent() == null || request.getContent().trim().isEmpty()) {
			log.warn("Note content is empty");
			throw new BaseException(BaseResponseStatus.NOTE_CONTENT_EMPTY);
		}
		// content 길이 제한 제거 (TEXT 타입은 무제한)
	}


	private void validateContentLength(String content) {
		// TEXT 타입으로 변경되어 길이 제한 제거
		// 향후 필요시 합리적인 제한 추가 가능 (예: 1MB)
	}

	@Override
	public Note enableNoteReminder(Long noteId, Long userId) {
		// todo: 개발 완료 후 제거할 로그
		log.info("리마인더 활성화 요청 - 노트 ID: {}, 사용자 ID: {}", noteId, userId);

		// 노트 존재 여부 확인
		Note note = noteRepository.findById(noteId)
			.orElseThrow(() -> new BaseException(BaseResponseStatus.NOTE_NOT_FOUND));

		// 노트 접근 권한 확인
		if (!note.getUser().getId().equals(userId)) {
			throw new BaseException(BaseResponseStatus.NOTE_ACCESS_DENIED);
		}

		// 리마인더 활성화 여부 확인
		if (note.isReminderEnable()) {
			throw new BaseException(BaseResponseStatus.REMINDER_ALREADY_ENABLED);
		}

		// 첫 리마인더 시간: 10초 후 (개발용, 실서비스에선 첫 알림은 1일 후)
		LocalDateTime firstReminderTime = LocalDateTime.now().plusSeconds(10);

		// 리마인더 활성화
		note.enableReminder(firstReminderTime);
		Note savedNote = noteRepository.save(note);

		// 스케줄러가 자동으로 처리하므로 별도 예약 불필요
		log.info("리마인더 활성화 완료 - noteId: {}, 첫 발송: {}", savedNote.getId(), savedNote.getRemindAt());

		return savedNote;
	}

	@Override
	public Note disableNoteReminder(Long noteId, Long userId) {
		// todo: 개발 완료 후 제거할 로그
		log.info("리마인더 비활성화 요청, 노트 ID : {}, 사용자 ID : {}", noteId, userId);

		// 노트 존재 여부 확인
		Note note = noteRepository.findById(noteId)
			.orElseThrow(() -> new BaseException(BaseResponseStatus.NOTE_NOT_FOUND));

		// 노트 접근 권환 확인
		if (!note.getUser().getId().equals(userId)) {
			throw new BaseException(BaseResponseStatus.NOTE_ACCESS_DENIED);
		}

		// 리마인더 비활성화 여부 확인
		if (!note.isReminderEnable()) {
			throw new BaseException(BaseResponseStatus.REMINDER_ALREADY_DISABLED);
		}

		// 리마인더 비활
		note.disableReminder();
		Note saveNote = noteRepository.save(note);

		return saveNote;
	}

	// processReminder는 ReminderSchedulerService에서 처리하므로 제거

	@Override
	@Transactional(readOnly = true)
	public List<NoteRecentResponse> getRecentNotes(Long userId) {
		log.info("Getting recent notes for user ID: {}", userId);

		// 최근 노트 10개 조회 (updatedAt DESC, noteId DESC)
		List<Note> notes = noteRepository.findRecentByUserId(userId, PageRequest.of(0, 10));

		// 데이터 없으면 null 반환
		if (notes.isEmpty()) {
			log.info("No recent notes found for user ID: {}", userId);
			return null;
		}

		// Note → NoteRecentResponse 변환
		List<NoteRecentResponse> recentNotes = notes.stream()
			.map(NoteRecentResponse::from)
			.toList();

		log.info("Found {} recent notes for user ID: {}", recentNotes.size(), userId);
		return recentNotes;
	}

	@Override
	@Transactional(readOnly = true)
	public List<NoteGraphNodeResponse> getGraphNodes(Long userId) {
		return noteRepository.findGraphNodesByUserId(userId);
	}

	@Override
	@Transactional(readOnly = true)
	public NoteReminderResponse getReminderNotes(Long userId, int page, int size) {
		log.info("Getting reminder notes for user ID: {} - page: {}, size: {}", userId, page, size);

		// 리마인더가 켜진 노트 조회 (페이징)
		Page<Note> notePage = noteRepository.findReminderNotesByUserId(userId, PageRequest.of(page, size));

		// Note → NoteReminderResult 변환
		List<NoteReminderResult> results = notePage.getContent().stream()
			.map(NoteReminderResult::from)
			.toList();

		// 응답 DTO 생성
		NoteReminderResponse response = NoteReminderResponse.builder()
			.results(results)
			.totalCount(notePage.getTotalElements())
			.currentPage(notePage.getNumber())
			.totalPages(notePage.getTotalPages())
			.pageSize(notePage.getSize())
			.build();

		log.info("Found {} reminder notes for user ID: {} (page {}/{})",
			results.size(), userId, page, notePage.getTotalPages());
		return response;
	}
}
