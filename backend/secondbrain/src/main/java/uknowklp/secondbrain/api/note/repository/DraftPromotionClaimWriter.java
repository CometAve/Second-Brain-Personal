package uknowklp.secondbrain.api.note.repository;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import uknowklp.secondbrain.api.note.domain.DraftPromotion;

/** Insert-only draft claim. Repository exception translation exposes PK conflicts. */
@Repository
@RequiredArgsConstructor
public class DraftPromotionClaimWriter {
	private final EntityManager entityManager;

	public DraftPromotion insert(String draftId, Long userId) {
		DraftPromotion claim = new DraftPromotion(draftId, userId);
		entityManager.persist(claim);
		entityManager.flush();
		return claim;
	}

	public void flush() {
		entityManager.flush();
	}
}
