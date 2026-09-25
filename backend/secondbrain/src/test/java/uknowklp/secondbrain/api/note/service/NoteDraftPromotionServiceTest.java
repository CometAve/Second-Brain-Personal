package uknowklp.secondbrain.api.note.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;

import uknowklp.secondbrain.api.note.domain.DraftPromotion;
import uknowklp.secondbrain.api.note.dto.NoteResponse;
import uknowklp.secondbrain.api.note.repository.DraftPromotionRepository;
import uknowklp.secondbrain.global.exception.BaseException;
import uknowklp.secondbrain.global.response.BaseResponseStatus;

class NoteDraftPromotionServiceTest {
	private final DraftLockService lock = mock(DraftLockService.class);
	private final NoteDraftService drafts = mock(NoteDraftService.class);
	private final NoteService notes = mock(NoteService.class);
	private final DraftPromotionRepository repository = mock(DraftPromotionRepository.class);
	private final NoteDraftPromotionService service =
		new NoteDraftPromotionService(lock, drafts, notes, repository);

	@Test
	void completedPromotionCanBeReadWithoutRedis() {
		DraftPromotion record = new DraftPromotion("draft-1", 7L);
		record.complete(42L);
		when(repository.findById("draft-1")).thenReturn(Optional.of(record));
		when(notes.getNoteById(42L, 7L)).thenReturn(NoteResponse.builder().noteId(42L).build());

		var result = service.promote("draft-1", 7L);
		assertThat(result.created()).isFalse();
		assertThat(result.note().getNoteId()).isEqualTo(42L);
		verifyNoInteractions(lock, drafts);
	}

	@Test
	void completedPromotionCannotBeReadByAnotherOwner() {
		DraftPromotion record = new DraftPromotion("draft-1", 7L);
		record.complete(42L);
		when(repository.findById("draft-1")).thenReturn(Optional.of(record));

		assertThatThrownBy(() -> service.promote("draft-1", 8L))
			.isInstanceOfSatisfying(BaseException.class,
				error -> assertThat(error.getStatus()).isEqualTo(BaseResponseStatus.DRAFT_ACCESS_DENIED));
		verifyNoInteractions(lock, drafts, notes);
	}
}
