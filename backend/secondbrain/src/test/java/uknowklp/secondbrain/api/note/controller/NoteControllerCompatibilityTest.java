package uknowklp.secondbrain.api.note.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import uknowklp.secondbrain.api.note.dto.NoteRequest;
import uknowklp.secondbrain.api.note.dto.NoteGraphNodeResponse;
import uknowklp.secondbrain.api.note.dto.NoteResponse;
import uknowklp.secondbrain.api.note.service.NoteDraftPromotionService;
import uknowklp.secondbrain.api.note.service.NoteService;
import uknowklp.secondbrain.api.user.domain.User;
import uknowklp.secondbrain.global.config.JacksonConfig;
import uknowklp.secondbrain.global.security.jwt.dto.CustomUserDetails;

class NoteControllerCompatibilityTest {
	private final NoteService noteService = mock(NoteService.class);
	private MockMvc mvc;

	@BeforeEach
	void setUp() {
		var details = new CustomUserDetails(User.builder().id(42L).email("local@example.test").build());
		SecurityContextHolder.getContext().setAuthentication(
			new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));
		mvc = MockMvcBuilders.standaloneSetup(new NoteController(noteService, mock(NoteDraftPromotionService.class)))
			.setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
			.setMessageConverters(new JacksonJsonHttpMessageConverter(new JacksonConfig().jsonMapper()))
			.build();
	}

	@AfterEach
	void clearAuthentication() {
		SecurityContextHolder.clearContext();
	}

	@Test
	void getNotePreservesResponseEnvelopeAndIsoDates() throws Exception {
		when(noteService.getNoteById(12L, 42L)).thenReturn(NoteResponse.builder()
			.noteId(12L).title("제목").content("본문")
			.createdAt(LocalDateTime.of(2026, 9, 24, 15, 30)).remindCount(0).build());
		mvc.perform(get("/api/notes/12"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.noteId").value(12))
			.andExpect(jsonPath("$.data.title").value("제목"))
			.andExpect(jsonPath("$.data.createdAt").value("2026-09-24T15:30:00"))
			.andExpect(jsonPath("$.httpStatus").doesNotExist())
			.andExpect(jsonPath("$.data['@class']").doesNotExist());
	}

	@Test
	void createNoteReadsExistingFrontendRequest() throws Exception {
		mvc.perform(post("/api/notes").contentType(MediaType.APPLICATION_JSON)
			.content("{\"title\":\"제목\",\"content\":\"본문\"}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.success").value(true));
		verify(noteService).createNote(eq(42L), any(NoteRequest.class));
	}

	@Test
	void graphNodesReturnOnlySavedNoteMetadataInResponseEnvelope() throws Exception {
		when(noteService.getGraphNodes(42L)).thenReturn(List.of(
			new NoteGraphNodeResponse(12L, "제목", LocalDateTime.of(2026, 9, 24, 15, 30))));

		mvc.perform(get("/api/notes/graph-nodes"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data[0].noteId").value(12))
			.andExpect(jsonPath("$.data[0].title").value("제목"))
			.andExpect(jsonPath("$.data[0].createdAt").value("2026-09-24T15:30:00"))
			.andExpect(jsonPath("$.data[0].content").doesNotExist())
			.andExpect(jsonPath("$.data[0].userId").doesNotExist());
		verify(noteService).getGraphNodes(42L);
	}

	@Test
	void graphNodesReturnEmptyArrayForNoSavedNotes() throws Exception {
		when(noteService.getGraphNodes(42L)).thenReturn(List.of());

		mvc.perform(get("/api/notes/graph-nodes"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data").isArray())
			.andExpect(jsonPath("$.data").isEmpty());
	}
}
