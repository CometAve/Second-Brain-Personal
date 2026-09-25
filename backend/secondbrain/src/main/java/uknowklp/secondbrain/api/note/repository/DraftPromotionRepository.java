package uknowklp.secondbrain.api.note.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uknowklp.secondbrain.api.note.domain.DraftPromotion;

public interface DraftPromotionRepository extends JpaRepository<DraftPromotion, String> {
}
