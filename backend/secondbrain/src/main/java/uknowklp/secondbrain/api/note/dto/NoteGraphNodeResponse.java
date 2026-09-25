package uknowklp.secondbrain.api.note.dto;

import java.time.LocalDateTime;

public record NoteGraphNodeResponse(
	Long noteId,
	String title,
	LocalDateTime createdAt
) {}
