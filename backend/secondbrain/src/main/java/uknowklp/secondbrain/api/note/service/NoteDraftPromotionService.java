package uknowklp.secondbrain.api.note.service;

import java.time.LocalDateTime;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uknowklp.secondbrain.api.note.constant.DraftProcessingStatus;
import uknowklp.secondbrain.api.note.domain.DraftPromotion;
import uknowklp.secondbrain.api.note.domain.Note;
import uknowklp.secondbrain.api.note.domain.NoteDraft;
import uknowklp.secondbrain.api.note.dto.NoteRequest;
import uknowklp.secondbrain.api.note.dto.NoteResponse;
import uknowklp.secondbrain.api.note.repository.DraftPromotionRepository;
import uknowklp.secondbrain.global.exception.BaseException;
import uknowklp.secondbrain.global.response.BaseResponseStatus;

/** One promotion path for HTTP requests and the stale-draft scheduler. */
@Service
@RequiredArgsConstructor
@Slf4j
public class NoteDraftPromotionService {
	private final DraftLockService draftLockService;
	private final NoteDraftService draftService;
	private final NoteService noteService;
	private final DraftPromotionRepository promotionRepository;

	public record Result(NoteResponse note, boolean created) {
	}

	public Result promote(String draftId, Long userId) {
		return promoteIfStale(draftId, userId, null);
	}

	/** The scheduler must recheck its scan's cutoff after acquiring the lock. */
	public Result promoteIfStale(String draftId, Long userId, LocalDateTime staleCutoff) {
		// A completed DB record can be returned even when Redis is unavailable.
		DraftPromotion completed = promotionRepository.findById(draftId).orElse(null);
		if (completed != null) {
			return existingResult(completed, userId);
		}
		return draftLockService.withLock(draftId, token -> promoteLocked(draftId, userId, token, staleCutoff));
	}

	private Result promoteLocked(String draftId, Long userId, String token,
		LocalDateTime staleCutoff) {
		DraftPromotion completed = promotionRepository.findById(draftId).orElse(null);
		if (completed != null) {
			return existingResult(completed, userId);
		}

		// Promotions created before the durable mapping was introduced retain their
		// original Redis status until it expires. Do not create a second note for them.
		String status = draftService.getProcessingStatus(draftId);
		if (status != null && !DraftProcessingStatus.isProcessing(status)) {
			try {
				return new Result(noteService.getNoteById(
					DraftProcessingStatus.parseDbNoteId(status), userId), false);
			} catch (NumberFormatException error) {
				throw new BaseException(BaseResponseStatus.REDIS_ERROR);
			}
		}

		NoteDraftService.PromotionStart start = draftService.beginPromotion(draftId, userId, token, staleCutoff);
		if (start == null) return null;
		NoteRequest request = start.draft().toNoteRequest();
		String processingToken = start.processingToken();
		Note savedNote;
		try {
			savedNote = noteService.createNoteFromDraft(userId, draftId, request);
		} catch (DataIntegrityViolationException conflict) {
			// A Redis lease may expire during a slow DB transaction. The unique DB
			// claim is authoritative; recover only if another transaction committed it.
			DraftPromotion winner = promotionRepository.findById(draftId).orElse(null);
			if (winner != null) {
				return existingResult(winner, userId);
			}
			draftService.rollbackProcessingStatus(draftId, processingToken);
			throw conflict;
		} catch (Exception error) {
			draftService.rollbackProcessingStatus(draftId, processingToken);
			throw error;
		}

		// The DB transaction has committed. Redis is now only cleanup/cache:
		// failures cannot turn the committed note into a creation failure.
		draftService.markAsCompleted(draftId, savedNote.getId());
		draftService.deleteDraftAfterPromotion(draftId, userId, token);
		log.info("Draft promoted - DraftId: {}, NoteId: {}", draftId, savedNote.getId());
		return new Result(NoteResponse.from(savedNote), true);
	}

	private Result existingResult(DraftPromotion promotion, Long userId) {
		if (!promotion.getUserId().equals(userId)) {
			throw new BaseException(BaseResponseStatus.DRAFT_ACCESS_DENIED);
		}
		if (promotion.getNoteId() == null) {
			throw new BaseException(BaseResponseStatus.DRAFT_ALREADY_PROCESSING);
		}
		return new Result(noteService.getNoteById(promotion.getNoteId(), userId), false);
	}
}
