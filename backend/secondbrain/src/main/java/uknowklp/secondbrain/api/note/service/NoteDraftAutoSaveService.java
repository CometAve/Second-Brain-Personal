package uknowklp.secondbrain.api.note.service;

import java.util.List;
import java.time.LocalDateTime;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uknowklp.secondbrain.api.note.domain.NoteDraft;

/** Promotes stale drafts through the same operation as the HTTP endpoint. */
@Slf4j
@Service
@RequiredArgsConstructor
public class NoteDraftAutoSaveService {
	private final NoteDraftService draftService;
	private final NoteDraftPromotionService promotionService;

	@Scheduled(fixedDelay = 300000)
	public void autoSaveStaleDrafts() {
		LocalDateTime staleCutoff = LocalDateTime.now().minusMinutes(5);
		List<NoteDraft> candidates;
		try {
			candidates = draftService.getStaleDrafts(5);
		} catch (Exception error) {
			log.error("Draft scan failed", error);
			return;
		}

		for (NoteDraft candidate : candidates) {
			try {
				// The scan is only a candidate list. Promotion re-reads the current
				// draft and owner after acquiring its per-draft lock.
				promotionService.promoteIfStale(candidate.getNoteId(), candidate.getUserId(), staleCutoff);
			} catch (Exception error) {
				// A partial or newer draft remains available for another save attempt.
				log.warn("Stale draft promotion failed - DraftId: {}",
					candidate.getNoteId(), error);
			}
		}
	}
}
