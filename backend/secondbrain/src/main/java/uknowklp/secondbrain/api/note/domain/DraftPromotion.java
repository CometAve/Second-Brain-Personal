package uknowklp.secondbrain.api.note.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** A durable idempotency record that outlives deletion of the promoted note. */
@Entity
@Table(name = "draft_promotions")
@Getter
@NoArgsConstructor
public class DraftPromotion {
	@Id
	@Column(name = "draft_id", nullable = false, length = 128)
	private String draftId;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(name = "note_id")
	private Long noteId;

	public DraftPromotion(String draftId, Long userId) {
		this.draftId = draftId;
		this.userId = userId;
	}

	public void complete(Long noteId) {
		this.noteId = noteId;
	}
}
