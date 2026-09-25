package uknowklp.secondbrain.api.note.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.time.LocalDateTime;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import uknowklp.secondbrain.api.note.domain.Note;
import uknowklp.secondbrain.api.note.dto.NoteDraftRequest;
import uknowklp.secondbrain.api.note.dto.NoteRequest;
import uknowklp.secondbrain.api.note.repository.DraftPromotionRepository;
import uknowklp.secondbrain.api.note.repository.NoteRepository;
import uknowklp.secondbrain.api.user.domain.User;
import uknowklp.secondbrain.api.user.repository.UserRepository;
import uknowklp.secondbrain.global.exception.BaseException;
import uknowklp.secondbrain.global.response.BaseResponseStatus;

@SpringBootTest
@ActiveProfiles("local")
@Tag("integration")
class DraftLifecycleIntegrationTest {
	// The real local Redis/DB may contain user drafts; the test must not run a
	// scheduler that promotes any draft outside its synthetic fixtures.
	@MockitoBean private NoteDraftAutoSaveService draftAutoSaveService;
	@Autowired private NoteDraftService drafts;
	@Autowired private NoteDraftPromotionService promotions;
	@Autowired private DraftLockService locks;
	@Autowired private NoteService notes;
	@Autowired private DraftPromotionRepository promotionRepository;
	@Autowired private NoteRepository noteRepository;
	@Autowired private UserRepository userRepository;
	@Autowired private StringRedisTemplate redis;
	@Autowired private RedisTemplate<String, Object> redisObjects;

	private final List<String> draftIds = new ArrayList<>();
	private final List<Long> userIds = new ArrayList<>();
	private final List<Long> noteIds = new ArrayList<>();

	private String draftId() {
		String id = UUID.randomUUID().toString();
		draftIds.add(id);
		return id;
	}

	private Long userId() {
		String nonce = UUID.randomUUID().toString();
		User user = userRepository.saveAndFlush(User.builder()
			.email("draft-test-" + nonce + "@example.test")
			.name("Draft Test")
			.setAlarm(false)
			.build());
		userIds.add(user.getId());
		return user.getId();
	}

	private NoteDraftRequest draftRequest(String id, String title, long version) {
		return NoteDraftRequest.builder()
			.noteId(id).title(title).content("Synthetic body").version(version).build();
	}

	@AfterEach
	void removeOnlySyntheticFixtures() {
		for (String id : draftIds) {
			var promotion = promotionRepository.findById(id);
			promotion.ifPresent(record -> {
				if (record.getNoteId() != null) noteIds.add(record.getNoteId());
			});
		}
		for (Long noteId : noteIds.stream().distinct().toList()) {
			if (noteRepository.existsById(noteId)) noteRepository.deleteById(noteId);
		}
		promotionRepository.deleteAllById(draftIds);
		for (String id : draftIds) {
			redis.delete("draft:note:" + id);
			redis.delete("processed:draft:" + id);
			redis.delete("deleted:draft:" + id);
			redis.delete("lock:draft:note:" + id);
		}
		for (Long userId : userIds) {
			redis.delete("user:drafts:" + userId);
			userRepository.deleteById(userId);
		}
	}

	@Test
	void ownerAndVersionAreEnforcedOnDraftWritesAndDelete() {
		Long owner = userId();
		Long other = userId();
		String id = draftId();
		drafts.saveDraft(owner, draftRequest(id, "Owner", 1));

		assertThatThrownBy(() -> drafts.saveDraft(other, draftRequest(id, "Foreign", 1)))
			.isInstanceOfSatisfying(BaseException.class,
				error -> assertThat(error.getStatus()).isEqualTo(BaseResponseStatus.DRAFT_ACCESS_DENIED));
		assertThat(drafts.getDraft(id, owner).getTitle()).isEqualTo("Owner");
		// A stale index entry must never expose another user's draft.
		redisObjects.opsForSet().add("user:drafts:" + other, id);
		assertThat(drafts.listUserDrafts(other)).isEmpty();

		assertThat(drafts.saveDraft(owner, draftRequest(id, "Owner v2", 1)).getVersion()).isEqualTo(2);
		assertThatThrownBy(() -> drafts.saveDraft(owner, draftRequest(id, "Stale", 1)))
			.isInstanceOfSatisfying(BaseException.class,
				error -> assertThat(error.getStatus()).isEqualTo(BaseResponseStatus.DRAFT_VERSION_CONFLICT));
		assertThatThrownBy(() -> drafts.deleteDraft(id, other, true))
			.isInstanceOfSatisfying(BaseException.class,
				error -> assertThat(error.getStatus()).isEqualTo(BaseResponseStatus.DRAFT_ACCESS_DENIED));
		assertThat(drafts.getDraft(id, owner).getTitle()).isEqualTo("Owner v2");
	}

	@Test
	void deletedDraftCannotBeRecreatedByLateVersionOneAutosave() {
		Long owner = userId();
		String id = draftId();
		drafts.saveDraft(owner, draftRequest(id, "Discarded", 1));
		drafts.deleteDraft(id, owner, true);
		assertThat(redis.hasKey("draft:note:" + id)).isFalse();
		assertThat(redis.hasKey("deleted:draft:" + id)).isTrue();
		assertThatThrownBy(() -> drafts.saveDraft(owner, draftRequest(id, "Late", 1)))
			.isInstanceOfSatisfying(BaseException.class,
				error -> assertThat(error.getStatus()).isEqualTo(BaseResponseStatus.DRAFT_ALREADY_PROCESSING));
		assertThat(redis.hasKey("draft:note:" + id)).isFalse();
		String freshId = draftId();
		assertThat(drafts.saveDraft(owner, draftRequest(freshId, "Fresh", 1)).getVersion()).isEqualTo(1);
	}

	@Test
	void concurrentSameVersionWritesHaveOneWinner() throws Exception {
		Long owner = userId();
		String id = draftId();
		drafts.saveDraft(owner, draftRequest(id, "Initial", 1));
		CountDownLatch ready = new CountDownLatch(2);
		CountDownLatch start = new CountDownLatch(1);
		try (var executor = Executors.newFixedThreadPool(2)) {
			List<Future<Object>> results = new ArrayList<>();
			for (String title : List.of("First", "Second")) {
				results.add(executor.submit((Callable<Object>) () -> {
					ready.countDown();
					start.await();
					try {
						return drafts.saveDraft(owner, draftRequest(id, title, 1));
					} catch (BaseException error) {
						return error.getStatus();
					}
				}));
			}
			ready.await();
			start.countDown();
			List<Object> outcomes = List.of(results.get(0).get(), results.get(1).get());
			assertThat(outcomes).filteredOn(value -> value == BaseResponseStatus.DRAFT_VERSION_CONFLICT)
				.hasSize(1);
			assertThat(drafts.getDraft(id, owner).getVersion()).isEqualTo(2);
		}
	}

	@Test
	void promotionReadsTheLatestDraftAndDeleteReportsMissing() {
		Long owner = userId();
		String id = draftId();
		drafts.saveDraft(owner, draftRequest(id, "Old", 1));
		drafts.saveDraft(owner, draftRequest(id, "Latest", 1));
		var promoted = promotions.promote(id, owner);
		noteIds.add(promoted.note().getNoteId());
		assertThat(promoted.note().getTitle()).isEqualTo("Latest");
		assertThat(noteRepository.findById(promoted.note().getNoteId()).orElseThrow().getTitle())
			.isEqualTo("Latest");

		String missing = draftId();
		assertThatThrownBy(() -> drafts.deleteDraft(missing, owner, true))
			.isInstanceOfSatisfying(BaseException.class,
				error -> assertThat(error.getStatus()).isEqualTo(BaseResponseStatus.DRAFT_NOT_FOUND));
	}

	@Test
	void repeatedPromotionSurvivesMissingRedisStatusAndBlocksLateAutosave() {
		Long owner = userId();
		String id = draftId();
		drafts.saveDraft(owner, draftRequest(id, "Saved", 1));
		var first = promotions.promote(id, owner);
		noteIds.add(first.note().getNoteId());
		assertThat(first.created()).isTrue();

		// Simulate loss of the Redis completion cache after the DB commit.
		redis.delete("processed:draft:" + id);
		var repeat = promotions.promote(id, owner);
		assertThat(repeat.created()).isFalse();
		assertThat(repeat.note().getNoteId()).isEqualTo(first.note().getNoteId());
		assertThatThrownBy(() -> drafts.saveDraft(owner, draftRequest(id, "Late", 1)))
			.isInstanceOfSatisfying(BaseException.class,
				error -> assertThat(error.getStatus()).isEqualTo(BaseResponseStatus.DRAFT_ALREADY_PROCESSING));
		assertThat(redis.hasKey("draft:note:" + id)).isFalse();

		// Deleting the note must not free the draft ID for a second promotion.
		noteRepository.deleteById(first.note().getNoteId());
		assertThatThrownBy(() -> promotions.promote(id, owner))
			.isInstanceOfSatisfying(BaseException.class,
				error -> assertThat(error.getStatus()).isEqualTo(BaseResponseStatus.NOTE_NOT_FOUND));
		assertThat(promotionRepository.findById(id)).isPresent();
	}

	@Test
	void committedPromotionHidesAndCanCleanUpAnOrphanRedisDraft() {
		Long owner = userId();
		String id = draftId();
		drafts.saveDraft(owner, draftRequest(id, "Saved", 1));
		String oldDraft = redis.opsForValue().get("draft:note:" + id);
		var first = promotions.promote(id, owner);
		noteIds.add(first.note().getNoteId());

		// Simulate Redis deletion failing after the DB commit.
		redis.opsForValue().set("draft:note:" + id, oldDraft);
		redisObjects.opsForSet().add("user:drafts:" + owner, id);
		assertThat(drafts.listUserDrafts(owner)).isEmpty();
		assertThatThrownBy(() -> drafts.getDraft(id, owner))
			.isInstanceOfSatisfying(BaseException.class,
				error -> assertThat(error.getStatus()).isEqualTo(BaseResponseStatus.DRAFT_NOT_FOUND));
		drafts.deleteDraft(id, owner, true);
		assertThat(redis.hasKey("draft:note:" + id)).isFalse();
	}

	@Test
	void retryOfOrphanProcessingStateClearsValidationFailure() {
		Long owner = userId();
		String id = draftId();
		drafts.saveDraft(owner, draftRequest(id, "", 1));
		redis.opsForValue().set("processed:draft:" + id, "PROCESSING:orphan-token");
		assertThatThrownBy(() -> promotions.promote(id, owner))
			.isInstanceOfSatisfying(BaseException.class,
				error -> assertThat(error.getStatus()).isEqualTo(BaseResponseStatus.NOTE_TITLE_EMPTY));
		assertThat(redis.hasKey("processed:draft:" + id)).isFalse();
		assertThat(drafts.saveDraft(owner, draftRequest(id, "Fixed", 1)).getVersion()).isEqualTo(2);
	}

	@Test
	void databaseClaimAllowsOnlyOneNoteEvenWithoutRedisLock() throws Exception {
		Long owner = userId();
		String id = draftId();
		NoteRequest request = NoteRequest.builder().title("Direct claim").content("Synthetic body").build();
		CountDownLatch ready = new CountDownLatch(2);
		CountDownLatch start = new CountDownLatch(1);
		try (var executor = Executors.newFixedThreadPool(2)) {
			List<Future<Object>> results = new ArrayList<>();
			for (int index = 0; index < 2; index++) {
				results.add(executor.submit((Callable<Object>) () -> {
					ready.countDown();
					start.await();
					try {
						return notes.createNoteFromDraft(owner, id, request);
					} catch (DataIntegrityViolationException error) {
						return error;
					}
				}));
			}
			ready.await();
			start.countDown();
			List<Object> outcomes = List.of(results.get(0).get(), results.get(1).get());
			assertThat(outcomes).filteredOn(Note.class::isInstance).hasSize(1);
			assertThat(outcomes).filteredOn(DataIntegrityViolationException.class::isInstance).hasSize(1);
			assertThat(promotionRepository.findById(id)).isPresent();
		}
	}

	@Test
	void sequentialDuplicateClaimCannotOverwriteCommittedMapping() {
		Long owner = userId();
		String id = draftId();
		NoteRequest request = NoteRequest.builder().title("Original").content("Synthetic body").build();
		Note first = notes.createNoteFromDraft(owner, id, request);
		noteIds.add(first.getId());
		assertThatThrownBy(() -> notes.createNoteFromDraft(owner, id,
			NoteRequest.builder().title("Duplicate").content("Synthetic body").build()))
			.isInstanceOf(DataIntegrityViolationException.class);
		assertThat(promotionRepository.findById(id).orElseThrow().getNoteId()).isEqualTo(first.getId());
		assertThat(noteRepository.findAll().stream().filter(note -> note.getUser().getId().equals(owner)))
			.hasSize(1);
	}

	@Test
	void schedulerSkipsDraftRefreshedAfterItsCandidateScan() {
		Long owner = userId();
		String id = draftId();
		drafts.saveDraft(owner, draftRequest(id, "Current", 1));
		assertThat(promotions.promoteIfStale(id, owner, LocalDateTime.now().minusMinutes(5))).isNull();
		assertThat(drafts.getDraft(id, owner).getTitle()).isEqualTo("Current");
		assertThat(promotionRepository.findById(id)).isEmpty();
	}

	@Test
	void expiredLockTokenCannotMarkANewerDraftAsProcessing() {
		Long owner = userId();
		String id = draftId();
		drafts.saveDraft(owner, draftRequest(id, "Current", 1));
		String lockKey = "lock:draft:note:" + id;
		redis.opsForValue().set(lockKey, "new-owner-token");
		assertThatThrownBy(() -> drafts.beginPromotion(id, owner, "stale-token", null))
			.isInstanceOfSatisfying(BaseException.class,
				error -> assertThat(error.getStatus()).isEqualTo(BaseResponseStatus.DRAFT_VERSION_CONFLICT));
		assertThat(redis.hasKey("processed:draft:" + id)).isFalse();
		assertThat(drafts.getDraft(id, owner).getTitle()).isEqualTo("Current");
	}

	@Test
	void invalidListIndexCannotAdvanceTheDraftVersion() {
		Long owner = userId();
		String id = draftId();
		redis.opsForValue().set("user:drafts:" + owner, "wrong-redis-type");
		assertThatThrownBy(() -> drafts.saveDraft(owner, draftRequest(id, "First", 1)))
			.isInstanceOfSatisfying(BaseException.class,
				error -> assertThat(error.getStatus()).isEqualTo(BaseResponseStatus.REDIS_ERROR));
		assertThat(redis.hasKey("draft:note:" + id)).isFalse();
		redis.delete("user:drafts:" + owner);
		assertThat(drafts.saveDraft(owner, draftRequest(id, "First", 1)).getVersion()).isEqualTo(1);
		assertThat(drafts.listUserDrafts(owner)).hasSize(1);
	}

	@Test
	void lockReleaseCannotDeleteANewOwnersToken() {
		String id = draftId();
		String key = "lock:draft:note:" + id;
		locks.withLock(id, token -> {
			redis.opsForValue().set(key, "replacement-token");
			return null;
		});
		assertThat(redis.opsForValue().get(key)).isEqualTo("replacement-token");
	}
}
