package uknowklp.secondbrain.api.note.service;

import java.util.List;

import uknowklp.secondbrain.api.note.domain.Note;
import uknowklp.secondbrain.api.note.dto.NoteRecentResponse;
import uknowklp.secondbrain.api.note.dto.NoteReminderResponse;
import uknowklp.secondbrain.api.note.dto.NoteRequest;
import uknowklp.secondbrain.api.note.dto.NoteResponse;

public interface NoteService {
	// 노트 생성
	Note createNote(Long userId, NoteRequest request);

	// Draft 승격과 멱등성 기록은 같은 DB 트랜잭션에서 커밋합니다.
	Note createNoteFromDraft(Long userId, String draftId, NoteRequest request);

	// 노트 조회 (권한 검증 포함)
	NoteResponse getNoteById(Long noteId, Long userId);

	// 노트 수정 (권한 검증 포함)
	NoteResponse updateNote(Long noteId, Long userId, NoteRequest request);

	// 노트 삭제 (다중 삭제 지원, 권한 검증 포함)
	void deleteNotes(List<Long> noteIds, Long userId);

	// 최근 노트 목록 조회 (상위 10개)
	List<NoteRecentResponse> getRecentNotes(Long userId);

	// 리마인더가 켜진 노트 목록 조회 (페이징 지원)
	NoteReminderResponse getReminderNotes(Long userId, int page, int size);

	// 특정 노트의 리마인더 활성화
	Note enableNoteReminder(Long noteId, Long userId);

	// 특정 노트의 리마인더 비활성화
	Note disableNoteReminder(Long noteId, Long userId);
}
