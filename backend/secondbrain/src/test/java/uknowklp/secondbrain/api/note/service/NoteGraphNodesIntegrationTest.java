package uknowklp.secondbrain.api.note.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import uknowklp.secondbrain.api.note.domain.Note;
import uknowklp.secondbrain.api.note.dto.NoteGraphNodeResponse;
import uknowklp.secondbrain.api.note.repository.NoteRepository;
import uknowklp.secondbrain.api.user.domain.User;
import uknowklp.secondbrain.api.user.repository.UserRepository;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
@Tag("integration")
@Transactional
class NoteGraphNodesIntegrationTest {
	@Autowired private NoteRepository noteRepository;
	@Autowired private UserRepository userRepository;
	@Autowired private NoteService noteService;
	@Value("${local.server.port}") private int port;
	@MockitoBean private NoteDraftAutoSaveService draftAutoSaveService;
	@MockitoBean private ReminderSchedulerService reminderSchedulerService;

	@Test
	void anonymousRequestRedirectsToLoginWithoutExposingGraphNodes() throws Exception {
		try (HttpClient client = HttpClient.newHttpClient()) {
			var response = client.send(HttpRequest.newBuilder(
				URI.create("http://127.0.0.1:" + port + "/api/notes/graph-nodes")).GET().build(),
				HttpResponse.BodyHandlers.ofString());
			assertThat(response.statusCode()).isEqualTo(302);
			assertThat(response.headers().firstValue("Location")).hasValueSatisfying(location ->
				assertThat(location).contains("/oauth2/authorization/"));
			assertThat(response.body()).doesNotContain("noteId", "title", "createdAt");
		}
	}

	@Test
	void graphNodesFollowSavedNotesForOneOwnerWithoutTenNoteLimit() {
		User owner = createUser();
		User other = createUser();
		assertThat(noteService.getGraphNodes(owner.getId())).isEmpty();

		List<Note> owned = new ArrayList<>();
		for (int index = 0; index < 12; index++) {
			owned.add(noteRepository.saveAndFlush(Note.builder()
				.user(owner).title("제목 " + index).content("비공개 본문 " + index).build()));
		}
		Note foreign = noteRepository.saveAndFlush(Note.builder()
			.user(other).title("다른 사용자").content("다른 사용자 본문").build());

		List<NoteGraphNodeResponse> nodes = noteService.getGraphNodes(owner.getId());
		assertThat(nodes).hasSize(12);
		assertThat(nodes).extracting(NoteGraphNodeResponse::noteId)
			.containsExactlyInAnyOrderElementsOf(owned.stream().map(Note::getId).toList());
		assertThat(nodes).extracting(NoteGraphNodeResponse::noteId).doesNotContain(foreign.getId());
		assertThat(nodes).allSatisfy(node -> assertThat(node.createdAt()).isNotNull());

		Note changed = owned.get(0);
		changed.update("바뀐 제목", changed.getContent());
		noteRepository.flush();
		assertThat(noteService.getGraphNodes(owner.getId())).anySatisfy(node -> {
			assertThat(node.noteId()).isEqualTo(changed.getId());
			assertThat(node.title()).isEqualTo("바뀐 제목");
		});

		noteRepository.delete(changed);
		noteRepository.flush();
		assertThat(noteService.getGraphNodes(owner.getId()))
			.extracting(NoteGraphNodeResponse::noteId).doesNotContain(changed.getId());
		assertThat(noteService.getGraphNodes(owner.getId())).hasSize(11);
	}

	private User createUser() {
		return userRepository.saveAndFlush(User.builder()
			.email("graph-test-" + UUID.randomUUID() + "@example.test")
			.name("Graph Test").setAlarm(false).build());
	}
}
