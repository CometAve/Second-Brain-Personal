package uknowklp.secondbrain.api.note.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.BDDMockito.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import uknowklp.secondbrain.api.note.domain.Note;
import uknowklp.secondbrain.api.note.dto.NoteRecentResponse;
import uknowklp.secondbrain.api.note.dto.NoteReminderResponse;
import uknowklp.secondbrain.api.note.dto.NoteRequest;
import uknowklp.secondbrain.api.note.dto.NoteResponse;
import uknowklp.secondbrain.api.note.repository.NoteRepository;
import uknowklp.secondbrain.api.user.domain.User;
import uknowklp.secondbrain.api.user.service.UserService;
import uknowklp.secondbrain.global.exception.BaseException;
import uknowklp.secondbrain.global.response.BaseResponseStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("NoteService 단위 테스트")
class NoteServiceImplTest {

	@InjectMocks
	private NoteServiceImpl noteService;

	@Mock
	private NoteRepository noteRepository;

	@Mock
	private UserService userService;

	@Mock
	private NoteSearchService noteSearchService;

	@Mock
	private KnowledgeGraphProducerService knowledgeGraphProducerService;

	private User testUser;
	private NoteRequest validRequest;

	// 각 테스트 실행 전에 공통적으로 필요한 객체를 설정
	@BeforeEach
	void setUp() {
		testUser = User.builder()
			.id(1L)
			.email("test@example.com")
			.name("테스트 사용자")
			.picture("http://example.com/picture.jpg")
			.setAlarm(false)
			.build();

		validRequest = NoteRequest.builder()
			.title("테스트 노트")
			.content("테스트 내용입니다.")
			.build();
	}

	@Test
	@DisplayName("노트 생성 성공 - 정상적인 요청")
	void createNote_Success() {
		// given: 유효한 사용자와 요청 DTO를 준비
		Long userId = 1L;
		Note expectedNote = Note.builder()
			.id(1L)
			.user(testUser)
			.title(validRequest.getTitle())
			.content(validRequest.getContent())
			.remindCount(0)
			.build();

		given(userService.findById(userId)).willReturn(Optional.of(testUser));
		given(noteRepository.save(any(Note.class))).willReturn(expectedNote);

		// when: 노트 생성을 실행
		Note createdNote = noteService.createNote(userId, validRequest);

		// then: 생성된 노트의 정보가 올바른지 확인
		assertNotNull(createdNote);
		assertEquals(validRequest.getTitle(), createdNote.getTitle());
		assertEquals(validRequest.getContent(), createdNote.getContent());
		assertEquals(testUser, createdNote.getUser());
		assertEquals(0, createdNote.getRemindCount());
		assertNull(createdNote.getRemindAt());

		// verify: 메서드 호출 검증
		verify(userService, times(1)).findById(userId);
		verify(noteRepository, times(1)).save(any(Note.class));
	}

	@Test
	@DisplayName("노트 생성 실패 - 존재하지 않는 사용자")
	void createNote_UserNotFound_ShouldThrowException() {
		// given: 존재하지 않는 사용자 ID를 준비
		Long nonExistentUserId = 999L;
		given(userService.findById(nonExistentUserId)).willReturn(Optional.empty());

		// when & then: USER_NOT_FOUND 예외가 발생하는지 확인
		BaseException exception = assertThrows(BaseException.class, () ->
			noteService.createNote(nonExistentUserId, validRequest)
		);
		assertEquals(BaseResponseStatus.USER_NOT_FOUND, exception.getStatus());

		// verify: userService는 호출되었지만, noteRepository.save는 호출되지 않았는지 확인
		verify(userService, times(1)).findById(nonExistentUserId);
		verify(noteRepository, never()).save(any(Note.class));
	}

	@Test
	@DisplayName("노트 생성 성공 - 제목과 내용이 정확히 저장됨")
	void createNote_TitleAndContentSavedCorrectly() {
		// given: 긴 제목과 내용을 가진 요청을 준비
		Long userId = 1L;
		NoteRequest longRequest = NoteRequest.builder()
			.title("이것은 긴 제목을 테스트하기 위한 노트입니다")
			.content("이것은 긴 내용을 테스트하기 위한 노트입니다. 여러 줄의 내용을 담을 수 있습니다.\n두 번째 줄입니다.\n세 번째 줄입니다.")
			.build();

		given(userService.findById(userId)).willReturn(Optional.of(testUser));
		given(noteRepository.save(any(Note.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when: 노트 생성을 실행
		Note createdNote = noteService.createNote(userId, longRequest);

		// then: 제목과 내용이 정확히 저장되었는지 확인
		assertEquals(longRequest.getTitle(), createdNote.getTitle());
		assertEquals(longRequest.getContent(), createdNote.getContent());
	}

	@Test
	@DisplayName("노트 생성 성공 - remindCount가 0으로 초기화됨")
	void createNote_RemindCountInitializedToZero() {
		// given: 유효한 사용자와 요청을 준비
		Long userId = 1L;
		given(userService.findById(userId)).willReturn(Optional.of(testUser));
		given(noteRepository.save(any(Note.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when: 노트 생성을 실행
		Note createdNote = noteService.createNote(userId, validRequest);

		// then: remindCount가 0으로 초기화되고 remindAt은 null인지 확인
		assertEquals(0, createdNote.getRemindCount());
		assertNull(createdNote.getRemindAt());
	}

	@Test
	@DisplayName("노트 생성 성공 - 사용자와 노트의 연관관계가 올바르게 설정됨")
	void createNote_UserRelationshipSetCorrectly() {
		// given: 유효한 사용자와 요청을 준비
		Long userId = 1L;
		given(userService.findById(userId)).willReturn(Optional.of(testUser));
		given(noteRepository.save(any(Note.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when: 노트 생성을 실행
		Note createdNote = noteService.createNote(userId, validRequest);

		// then: User 연관관계가 올바르게 설정되었는지 확인
		assertNotNull(createdNote.getUser());
		assertEquals(userId, createdNote.getUser().getId());
		assertEquals(testUser.getEmail(), createdNote.getUser().getEmail());
		assertEquals(testUser.getName(), createdNote.getUser().getName());
	}

	@Test
	@DisplayName("노트 생성 성공 - 최대 길이 제한에 근접한 입력")
	void createNote_MaxLengthInput() {
		// given: 최대 길이에 근접한 제목과 내용을 준비
		Long userId = 1L;
		String maxTitle = "a".repeat(64); // 64자 제목
		String maxContent = "b".repeat(2048); // 2048자 내용
		NoteRequest maxRequest = NoteRequest.builder()
			.title(maxTitle)
			.content(maxContent)
			.build();

		given(userService.findById(userId)).willReturn(Optional.of(testUser));
		given(noteRepository.save(any(Note.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when: 노트 생성을 실행
		Note createdNote = noteService.createNote(userId, maxRequest);

		// then: 최대 길이의 데이터가 정확히 저장되었는지 확인
		assertEquals(64, createdNote.getTitle().length());
		assertEquals(2048, createdNote.getContent().length());
		assertEquals(maxTitle, createdNote.getTitle());
		assertEquals(maxContent, createdNote.getContent());
	}

	@Test
	@DisplayName("노트 생성 성공 - 여러 사용자가 각각 노트를 생성할 수 있음")
	void createNote_MultipleUsersCanCreateNotes() {
		// given: 두 명의 다른 사용자를 준비
		Long userId1 = 1L;
		Long userId2 = 2L;
		User user2 = User.builder()
			.id(2L)
			.email("user2@example.com")
			.name("사용자2")
			.picture("http://example.com/picture2.jpg")
			.setAlarm(false)
			.build();

		given(userService.findById(userId1)).willReturn(Optional.of(testUser));
		given(userService.findById(userId2)).willReturn(Optional.of(user2));
		given(noteRepository.save(any(Note.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when: 각 사용자가 노트를 생성
		Note note1 = noteService.createNote(userId1, validRequest);
		Note note2 = noteService.createNote(userId2, validRequest);

		// then: 각 노트가 올바른 사용자와 연관되어 있는지 확인
		assertEquals(userId1, note1.getUser().getId());
		assertEquals(userId2, note2.getUser().getId());
		assertNotEquals(note1.getUser().getId(), note2.getUser().getId());

		// verify: 각 사용자에 대해 메서드가 호출되었는지 확인
		verify(userService, times(1)).findById(userId1);
		verify(userService, times(1)).findById(userId2);
		verify(noteRepository, times(2)).save(any(Note.class));
	}

	@Test
	@DisplayName("노트 생성 성공 - 이미지 파일 없이 생성")
	void createNote_WithoutImages_Success() {
		// given: 이미지가 없는 요청
		Long userId = 1L;
		NoteRequest requestWithoutImages = NoteRequest.builder()
			.title("이미지 없는 노트")
			.content("텍스트만 있는 노트입니다.")
			.build();

		given(userService.findById(userId)).willReturn(Optional.of(testUser));
		given(noteRepository.save(any(Note.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when: 노트 생성
		Note createdNote = noteService.createNote(userId, requestWithoutImages);

		// then: 이미지 마크다운 없이 content가 그대로 저장됨
		assertEquals("텍스트만 있는 노트입니다.", createdNote.getContent());
		verify(noteRepository, times(1)).save(any(Note.class));
	}

	@Test
	@DisplayName("노트 생성 성공 - 업로드된 단일 이미지 본문 유지")
	void createNote_WithSingleImage_Success() {
		// given: 이미 업로드한 이미지 URL을 본문에 포함한 JSON 요청
		Long userId = 1L;
		NoteRequest requestWithImage = NoteRequest.builder()
			.title("이미지 포함 노트")
			.content("이미지가 포함된 노트입니다.\n![test-image.jpg](https://images.example.test/test-image.jpg)")
			.build();

		given(userService.findById(userId)).willReturn(Optional.of(testUser));
		given(noteRepository.save(any(Note.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when: 노트 생성
		Note createdNote = noteService.createNote(userId, requestWithImage);

		// then: 전달받은 이미지 마크다운이 content에 유지됨
		assertNotNull(createdNote.getContent());
		assertTrue(createdNote.getContent().contains("이미지가 포함된 노트입니다."));
		assertTrue(createdNote.getContent().contains("![test-image.jpg]"));
		assertTrue(createdNote.getContent().contains("https://images.example.test/test-image.jpg"));
		verify(noteRepository, times(1)).save(any(Note.class));
	}

	@Test
	@DisplayName("노트 생성 성공 - 업로드된 다중 이미지 본문 유지")
	void createNote_WithMultipleImages_Success() {
		// given: 이미 업로드한 여러 이미지 URL을 본문에 포함한 JSON 요청
		Long userId = 1L;
		NoteRequest requestWithImages = NoteRequest.builder()
			.title("다중 이미지 노트")
			.content("여러 이미지가 포함된 노트입니다.\n![image1.jpg](https://images.example.test/image1.jpg)"
				+ "\n![image2.png](https://images.example.test/image2.png)\n![image3.gif](https://images.example.test/image3.gif)")
			.build();

		given(userService.findById(userId)).willReturn(Optional.of(testUser));
		given(noteRepository.save(any(Note.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when: 노트 생성
		Note createdNote = noteService.createNote(userId, requestWithImages);

		// then: 전달받은 모든 이미지 마크다운이 content에 유지됨
		assertNotNull(createdNote.getContent());
		assertTrue(createdNote.getContent().contains("여러 이미지가 포함된 노트입니다."));
		assertTrue(createdNote.getContent().contains("![image1.jpg]"));
		assertTrue(createdNote.getContent().contains("![image2.png]"));
		assertTrue(createdNote.getContent().contains("![image3.gif]"));
		assertTrue(createdNote.getContent().contains("https://images.example.test/image1.jpg"));
		assertTrue(createdNote.getContent().contains("https://images.example.test/image2.png"));
		assertTrue(createdNote.getContent().contains("https://images.example.test/image3.gif"));
		verify(noteRepository, times(1)).save(any(Note.class));
	}

	@Test
	@DisplayName("노트 생성 성공 - 빈 이미지 리스트")
	void createNote_WithEmptyImageList_Success() {
		// given: 빈 이미지 리스트
		Long userId = 1L;
		NoteRequest requestWithEmptyList = NoteRequest.builder()
			.title("빈 이미지 리스트 노트")
			.content("이미지 리스트가 비어있습니다.")
			.build();

		given(userService.findById(userId)).willReturn(Optional.of(testUser));
		given(noteRepository.save(any(Note.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when: 노트 생성
		Note createdNote = noteService.createNote(userId, requestWithEmptyList);

		// then: content가 그대로 저장됨
		assertEquals("이미지 리스트가 비어있습니다.", createdNote.getContent());
		verify(noteRepository, times(1)).save(any(Note.class));
	}

	// ========================================
	// getNoteById 메서드 테스트
	// ========================================

	@Test
	@DisplayName("노트 조회 성공 - 본인 노트 조회")
	void getNoteById_Success() {
		// given: 존재하는 노트를 준비
		Long noteId = 1L;
		Long userId = 1L;
		Note existingNote = Note.builder()
			.id(noteId)
			.user(testUser)
			.title("테스트 노트")
			.content("테스트 내용입니다.")
			.remindCount(0)
			.build();

		given(noteRepository.findById(noteId)).willReturn(Optional.of(existingNote));

		// when: 노트 조회를 실행
		NoteResponse response = noteService.getNoteById(noteId, userId);

		// then: 조회된 노트 정보가 올바른지 확인
		assertNotNull(response);
		assertEquals(noteId, response.getNoteId());
		assertEquals("테스트 노트", response.getTitle());
		assertEquals("테스트 내용입니다.", response.getContent());
		assertNull(response.getRemindAt());

		// verify: 메서드 호출 검증
		verify(noteRepository, times(1)).findById(noteId);
	}

	@Test
	@DisplayName("노트 조회 실패 - 존재하지 않는 노트")
	void getNoteById_NoteNotFound_ShouldThrowException() {
		// given: 존재하지 않는 노트 ID를 준비
		Long nonExistentNoteId = 999L;
		Long userId = 1L;
		given(noteRepository.findById(nonExistentNoteId)).willReturn(Optional.empty());

		// when & then: NOTE_NOT_FOUND 예외가 발생하는지 확인
		BaseException exception = assertThrows(BaseException.class, () ->
			noteService.getNoteById(nonExistentNoteId, userId)
		);
		assertEquals(BaseResponseStatus.NOTE_NOT_FOUND, exception.getStatus());

		// verify: noteRepository.findById는 호출되었는지 확인
		verify(noteRepository, times(1)).findById(nonExistentNoteId);
	}

	@Test
	@DisplayName("노트 조회 실패 - 다른 사용자의 노트 접근 시도")
	void getNoteById_AccessDenied_ShouldThrowException() {
		// given: 다른 사용자의 노트를 준비
		Long noteId = 1L;
		Long ownerId = 1L;
		Long unauthorizedUserId = 2L;

		User owner = User.builder()
			.id(ownerId)
			.email("owner@example.com")
			.name("소유자")
			.build();

		Note otherUserNote = Note.builder()
			.id(noteId)
			.user(owner)
			.title("소유자의 노트")
			.content("다른 사용자의 내용")
			.remindCount(0)
			.build();

		given(noteRepository.findById(noteId)).willReturn(Optional.of(otherUserNote));

		// when & then: NOTE_ACCESS_DENIED 예외가 발생하는지 확인
		BaseException exception = assertThrows(BaseException.class, () ->
			noteService.getNoteById(noteId, unauthorizedUserId)
		);
		assertEquals(BaseResponseStatus.NOTE_ACCESS_DENIED, exception.getStatus());

		// verify: noteRepository.findById는 호출되었는지 확인
		verify(noteRepository, times(1)).findById(noteId);
	}

	@Test
	@DisplayName("노트 조회 성공 - remindAt이 설정된 노트")
	void getNoteById_WithRemindAt_Success() {
		// given: remindAt이 설정된 노트를 준비
		Long noteId = 1L;
		Long userId = 1L;
		java.time.LocalDateTime remindTime = java.time.LocalDateTime.now().plusDays(1);
		Note noteWithRemind = Note.builder()
			.id(noteId)
			.user(testUser)
			.title("리마인더 노트")
			.content("리마인더가 설정된 노트입니다.")
			.remindCount(0)
			.remindAt(remindTime)
			.build();

		given(noteRepository.findById(noteId)).willReturn(Optional.of(noteWithRemind));

		// when: 노트 조회를 실행
		NoteResponse response = noteService.getNoteById(noteId, userId);

		// then: remindAt 필드가 포함된 응답 확인
		assertNotNull(response);
		assertEquals(noteId, response.getNoteId());
		assertEquals("리마인더 노트", response.getTitle());
		assertEquals("리마인더가 설정된 노트입니다.", response.getContent());
		assertEquals(remindTime, response.getRemindAt());

		verify(noteRepository, times(1)).findById(noteId);
	}

	@Test
	@DisplayName("노트 조회 성공 - 여러 사용자가 각자 자신의 노트를 조회")
	void getNoteById_MultipleUsersCanAccessTheirOwnNotes() {
		// given: 두 명의 사용자와 각각의 노트를 준비
		Long userId1 = 1L;
		Long userId2 = 2L;
		Long noteId1 = 1L;
		Long noteId2 = 2L;

		User user2 = User.builder()
			.id(userId2)
			.email("user2@example.com")
			.name("사용자2")
			.build();

		Note note1 = Note.builder()
			.id(noteId1)
			.user(testUser)
			.title("사용자1의 노트")
			.content("사용자1의 내용")
			.remindCount(0)
			.build();

		Note note2 = Note.builder()
			.id(noteId2)
			.user(user2)
			.title("사용자2의 노트")
			.content("사용자2의 내용")
			.remindCount(0)
			.build();

		given(noteRepository.findById(noteId1)).willReturn(Optional.of(note1));
		given(noteRepository.findById(noteId2)).willReturn(Optional.of(note2));

		// when: 각 사용자가 자신의 노트를 조회
		NoteResponse response1 = noteService.getNoteById(noteId1, userId1);
		NoteResponse response2 = noteService.getNoteById(noteId2, userId2);

		// then: 각자의 노트를 올바르게 조회
		assertEquals(noteId1, response1.getNoteId());
		assertEquals("사용자1의 노트", response1.getTitle());
		assertEquals(noteId2, response2.getNoteId());
		assertEquals("사용자2의 노트", response2.getTitle());

		// verify: 각 노트에 대해 메서드가 호출되었는지 확인
		verify(noteRepository, times(1)).findById(noteId1);
		verify(noteRepository, times(1)).findById(noteId2);
	}

	@Test
	@DisplayName("노트 조회 성공 - 긴 제목과 내용 조회")
	void getNoteById_LongTitleAndContent_Success() {
		// given: 최대 길이의 제목과 내용을 가진 노트
		Long noteId = 1L;
		Long userId = 1L;
		String maxTitle = "a".repeat(64);
		String maxContent = "b".repeat(2048);

		Note longNote = Note.builder()
			.id(noteId)
			.user(testUser)
			.title(maxTitle)
			.content(maxContent)
			.remindCount(0)
			.build();

		given(noteRepository.findById(noteId)).willReturn(Optional.of(longNote));

		// when: 노트 조회
		NoteResponse response = noteService.getNoteById(noteId, userId);

		// then: 긴 제목과 내용이 정확히 조회됨
		assertNotNull(response);
		assertEquals(64, response.getTitle().length());
		assertEquals(2048, response.getContent().length());
		assertEquals(maxTitle, response.getTitle());
		assertEquals(maxContent, response.getContent());

		verify(noteRepository, times(1)).findById(noteId);
	}

	// ========================================
	// updateNote 메서드 테스트
	// ========================================

	@Test
	@DisplayName("노트 수정 성공 - 정상적인 요청")
	void updateNote_Success() {
		// given
		Long noteId = 1L;
		Long userId = 1L;
		NoteRequest updateRequest = NoteRequest.builder()
			.title("수정된 제목")
			.content("수정된 내용")
			.build();

		Note existingNote = Note.builder()
			.id(noteId)
			.user(testUser)
			.title("기존 제목")
			.content("기존 내용")
			.remindCount(0)
			.build();

		given(noteRepository.findById(noteId)).willReturn(Optional.of(existingNote));
		given(noteRepository.save(any(Note.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when
		NoteResponse response = noteService.updateNote(noteId, userId, updateRequest);

		// then
		assertNotNull(response);
		assertEquals("수정된 제목", response.getTitle());
		assertEquals("수정된 내용", response.getContent());

		verify(noteRepository, times(1)).findById(noteId);
		verify(noteRepository, times(1)).save(any(Note.class));
	}

	@Test
	@DisplayName("노트 수정 실패 - 존재하지 않는 노트")
	void updateNote_NoteNotFound_ThrowsException() {
		// given
		Long nonExistentNoteId = 999L;
		Long userId = 1L;
		NoteRequest updateRequest = NoteRequest.builder()
			.title("수정된 제목")
			.content("수정된 내용")
			.build();

		given(noteRepository.findById(nonExistentNoteId)).willReturn(Optional.empty());

		// when & then
		BaseException exception = assertThrows(BaseException.class, () ->
			noteService.updateNote(nonExistentNoteId, userId, updateRequest)
		);
		assertEquals(BaseResponseStatus.NOTE_NOT_FOUND, exception.getStatus());

		verify(noteRepository, times(1)).findById(nonExistentNoteId);
		verify(noteRepository, never()).save(any(Note.class));
	}

	@Test
	@DisplayName("노트 수정 실패 - 다른 사용자의 노트 수정 시도")
	void updateNote_AccessDenied_ThrowsException() {
		// given
		Long noteId = 1L;
		Long ownerId = 1L;
		Long unauthorizedUserId = 2L;

		User owner = User.builder()
			.id(ownerId)
			.email("owner@example.com")
			.name("소유자")
			.build();

		Note otherUserNote = Note.builder()
			.id(noteId)
			.user(owner)
			.title("소유자의 노트")
			.content("다른 사용자의 내용")
			.remindCount(0)
			.build();

		NoteRequest updateRequest = NoteRequest.builder()
			.title("수정된 제목")
			.content("수정된 내용")
			.build();

		given(noteRepository.findById(noteId)).willReturn(Optional.of(otherUserNote));

		// when & then
		BaseException exception = assertThrows(BaseException.class, () ->
			noteService.updateNote(noteId, unauthorizedUserId, updateRequest)
		);
		assertEquals(BaseResponseStatus.NOTE_ACCESS_DENIED, exception.getStatus());

		verify(noteRepository, times(1)).findById(noteId);
		verify(noteRepository, never()).save(any(Note.class));
	}

	@Test
	@DisplayName("노트 수정 성공 - 업로드된 이미지 본문 유지")
	void updateNote_WithImages_Success() {
		// given
		Long noteId = 1L;
		Long userId = 1L;

		NoteRequest updateRequest = NoteRequest.builder()
			.title("이미지 수정")
			.content("이미지가 추가된 내용\n![updated-image.jpg](https://images.example.test/updated-image.jpg)")
			.build();

		Note existingNote = Note.builder()
			.id(noteId)
			.user(testUser)
			.title("기존 제목")
			.content("기존 내용")
			.remindCount(0)
			.build();

		given(noteRepository.findById(noteId)).willReturn(Optional.of(existingNote));
		given(noteRepository.save(any(Note.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when
		NoteResponse response = noteService.updateNote(noteId, userId, updateRequest);

		// then
		assertNotNull(response);
		assertTrue(response.getContent().contains("이미지가 추가된 내용"));
		assertTrue(response.getContent().contains("![updated-image.jpg]"));

		verify(noteRepository, times(1)).findById(noteId);
		verify(noteRepository, times(1)).save(any(Note.class));
	}

	@Test
	@DisplayName("노트 수정 성공 - 최대 길이 제목과 내용")
	void updateNote_MaxLength_Success() {
		// given
		Long noteId = 1L;
		Long userId = 1L;
		String maxTitle = "a".repeat(64);
		String maxContent = "b".repeat(2048);

		NoteRequest updateRequest = NoteRequest.builder()
			.title(maxTitle)
			.content(maxContent)
			.build();

		Note existingNote = Note.builder()
			.id(noteId)
			.user(testUser)
			.title("기존 제목")
			.content("기존 내용")
			.remindCount(0)
			.build();

		given(noteRepository.findById(noteId)).willReturn(Optional.of(existingNote));
		given(noteRepository.save(any(Note.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when
		NoteResponse response = noteService.updateNote(noteId, userId, updateRequest);

		// then
		assertNotNull(response);
		assertEquals(64, response.getTitle().length());
		assertEquals(2048, response.getContent().length());

		verify(noteRepository, times(1)).findById(noteId);
		verify(noteRepository, times(1)).save(any(Note.class));
	}

	@Test
	@DisplayName("노트 수정 실패 - 제목이 빈 문자열")
	void updateNote_EmptyTitle_ThrowsException() {
		// given
		Long noteId = 1L;
		Long userId = 1L;
		NoteRequest updateRequest = NoteRequest.builder()
			.title("")
			.content("수정된 내용")
			.build();

		// when & then
		BaseException exception = assertThrows(BaseException.class, () ->
			noteService.updateNote(noteId, userId, updateRequest)
		);
		assertEquals(BaseResponseStatus.NOTE_TITLE_EMPTY, exception.getStatus());

		verify(noteRepository, never()).findById(anyLong());
		verify(noteRepository, never()).save(any(Note.class));
	}

	@Test
	@DisplayName("노트 수정 실패 - 내용이 빈 문자열")
	void updateNote_EmptyContent_ThrowsException() {
		// given
		Long noteId = 1L;
		Long userId = 1L;
		NoteRequest updateRequest = NoteRequest.builder()
			.title("수정된 제목")
			.content("")
			.build();

		// when & then
		BaseException exception = assertThrows(BaseException.class, () ->
			noteService.updateNote(noteId, userId, updateRequest)
		);
		assertEquals(BaseResponseStatus.NOTE_CONTENT_EMPTY, exception.getStatus());

		verify(noteRepository, never()).findById(anyLong());
		verify(noteRepository, never()).save(any(Note.class));
	}

	// ========================================
	// deleteNotes 메서드 테스트
	// ========================================

	@Test
	@DisplayName("노트 삭제 성공 - 단일 노트 삭제")
	void deleteNotes_Success_SingleNote() {
		// given: 삭제할 단일 노트 준비
		Long noteId = 1L;
		Long userId = 1L;
		List<Long> noteIds = List.of(noteId);

		Note noteToDelete = Note.builder()
			.id(noteId)
			.user(testUser)
			.title("삭제할 노트")
			.content("삭제될 내용")
			.remindCount(0)
			.build();

		given(noteRepository.findAllById(noteIds)).willReturn(List.of(noteToDelete));

		// when: 노트 삭제 실행
		noteService.deleteNotes(noteIds, userId);

		// then: 삭제 메서드가 호출되었는지 확인
		verify(noteRepository, times(1)).findAllById(noteIds);
		verify(noteRepository, times(1)).deleteAll(List.of(noteToDelete));
	}

	@Test
	@DisplayName("노트 삭제 성공 - 다중 노트 삭제")
	void deleteNotes_Success_MultipleNotes() {
		// given: 삭제할 여러 노트 준비
		Long noteId1 = 1L;
		Long noteId2 = 2L;
		Long noteId3 = 3L;
		Long userId = 1L;
		List<Long> noteIds = List.of(noteId1, noteId2, noteId3);

		Note note1 = Note.builder()
			.id(noteId1)
			.user(testUser)
			.title("노트1")
			.content("내용1")
			.remindCount(0)
			.build();

		Note note2 = Note.builder()
			.id(noteId2)
			.user(testUser)
			.title("노트2")
			.content("내용2")
			.remindCount(0)
			.build();

		Note note3 = Note.builder()
			.id(noteId3)
			.user(testUser)
			.title("노트3")
			.content("내용3")
			.remindCount(0)
			.build();

		List<Note> notesToDelete = List.of(note1, note2, note3);
		given(noteRepository.findAllById(noteIds)).willReturn(notesToDelete);

		// when: 노트 삭제 실행
		noteService.deleteNotes(noteIds, userId);

		// then: 삭제 메서드가 호출되었는지 확인
		verify(noteRepository, times(1)).findAllById(noteIds);
		verify(noteRepository, times(1)).deleteAll(notesToDelete);
	}

	@Test
	@DisplayName("노트 삭제 실패 - 중복된 ID가 포함된 경우")
	void deleteNotes_DuplicateIds_ThrowsException() {
		// given: 중복된 ID를 포함한 요청
		Long noteId = 1L;
		Long userId = 1L;
		List<Long> duplicateNoteIds = List.of(noteId, noteId, 2L); // ID 1이 중복

		// when & then: BAD_REQUEST 예외가 발생하는지 확인
		BaseException exception = assertThrows(BaseException.class, () ->
			noteService.deleteNotes(duplicateNoteIds, userId)
		);
		assertEquals(BaseResponseStatus.BAD_REQUEST, exception.getStatus());

		// verify: 중복 검증 단계에서 실패하므로 repository 메서드는 호출되지 않음
		verify(noteRepository, never()).findAllById(anyList());
		verify(noteRepository, never()).deleteAll(anyList());
	}

	@Test
	@DisplayName("노트 삭제 실패 - 존재하지 않는 노트")
	void deleteNotes_NoteNotFound_ThrowsException() {
		// given: 일부 노트가 존재하지 않는 경우
		Long noteId1 = 1L;
		Long noteId2 = 999L; // 존재하지 않는 노트
		Long userId = 1L;
		List<Long> noteIds = List.of(noteId1, noteId2);

		Note note1 = Note.builder()
			.id(noteId1)
			.user(testUser)
			.title("노트1")
			.content("내용1")
			.remindCount(0)
			.build();

		// findAllById는 note1만 반환 (note2는 존재하지 않음)
		given(noteRepository.findAllById(noteIds)).willReturn(List.of(note1));

		// when & then: NOTE_NOT_FOUND 예외가 발생하는지 확인
		BaseException exception = assertThrows(BaseException.class, () ->
			noteService.deleteNotes(noteIds, userId)
		);
		assertEquals(BaseResponseStatus.NOTE_NOT_FOUND, exception.getStatus());

		// verify: findAllById는 호출되었지만 deleteAll은 호출되지 않음
		verify(noteRepository, times(1)).findAllById(noteIds);
		verify(noteRepository, never()).deleteAll(anyList());
	}

	@Test
	@DisplayName("노트 삭제 실패 - 다른 사용자의 노트 삭제 시도")
	void deleteNotes_AccessDenied_ThrowsException() {
		// given: 다른 사용자의 노트를 삭제 시도
		Long noteId = 1L;
		Long ownerId = 1L;
		Long unauthorizedUserId = 2L;
		List<Long> noteIds = List.of(noteId);

		User owner = User.builder()
			.id(ownerId)
			.email("owner@example.com")
			.name("소유자")
			.build();

		Note otherUserNote = Note.builder()
			.id(noteId)
			.user(owner)
			.title("소유자의 노트")
			.content("다른 사용자의 내용")
			.remindCount(0)
			.build();

		given(noteRepository.findAllById(noteIds)).willReturn(List.of(otherUserNote));

		// when & then: NOTE_ACCESS_DENIED 예외가 발생하는지 확인
		BaseException exception = assertThrows(BaseException.class, () ->
			noteService.deleteNotes(noteIds, unauthorizedUserId)
		);
		assertEquals(BaseResponseStatus.NOTE_ACCESS_DENIED, exception.getStatus());

		// verify: findAllById는 호출되었지만 deleteAll은 호출되지 않음
		verify(noteRepository, times(1)).findAllById(noteIds);
		verify(noteRepository, never()).deleteAll(anyList());
	}

	@Test
	@DisplayName("노트 삭제 실패 - 모든 노트가 다른 사용자 소유")
	void deleteNotes_AllNotesOtherUser_ThrowsException() {
		// given: 여러 노트 모두 다른 사용자 소유
		Long noteId1 = 1L;
		Long noteId2 = 2L;
		Long ownerId = 1L;
		Long unauthorizedUserId = 2L;
		List<Long> noteIds = List.of(noteId1, noteId2);

		User owner = User.builder()
			.id(ownerId)
			.email("owner@example.com")
			.name("소유자")
			.build();

		Note note1 = Note.builder()
			.id(noteId1)
			.user(owner)
			.title("소유자의 노트1")
			.content("내용1")
			.remindCount(0)
			.build();

		Note note2 = Note.builder()
			.id(noteId2)
			.user(owner)
			.title("소유자의 노트2")
			.content("내용2")
			.remindCount(0)
			.build();

		given(noteRepository.findAllById(noteIds)).willReturn(List.of(note1, note2));

		// when & then: NOTE_ACCESS_DENIED 예외가 발생하는지 확인
		BaseException exception = assertThrows(BaseException.class, () ->
			noteService.deleteNotes(noteIds, unauthorizedUserId)
		);
		assertEquals(BaseResponseStatus.NOTE_ACCESS_DENIED, exception.getStatus());

		// verify: findAllById는 호출되었지만 deleteAll은 호출되지 않음
		verify(noteRepository, times(1)).findAllById(noteIds);
		verify(noteRepository, never()).deleteAll(anyList());
	}

	@Test
	@DisplayName("노트 삭제 실패 - 일부 노트만 본인 소유 (혼합 소유권)")
	void deleteNotes_PartialOwnership_ThrowsException() {
		// given: 일부는 본인 소유, 일부는 다른 사용자 소유
		Long noteId1 = 1L;
		Long noteId2 = 2L;
		Long userId = 1L;
		Long otherUserId = 2L;
		List<Long> noteIds = List.of(noteId1, noteId2);

		User otherUser = User.builder()
			.id(otherUserId)
			.email("other@example.com")
			.name("다른 사용자")
			.build();

		Note ownNote = Note.builder()
			.id(noteId1)
			.user(testUser)
			.title("내 노트")
			.content("내 내용")
			.remindCount(0)
			.build();

		Note otherNote = Note.builder()
			.id(noteId2)
			.user(otherUser)
			.title("다른 사람 노트")
			.content("다른 사람 내용")
			.remindCount(0)
			.build();

		given(noteRepository.findAllById(noteIds)).willReturn(List.of(ownNote, otherNote));

		// when & then: NOTE_ACCESS_DENIED 예외가 발생하는지 확인
		BaseException exception = assertThrows(BaseException.class, () ->
			noteService.deleteNotes(noteIds, userId)
		);
		assertEquals(BaseResponseStatus.NOTE_ACCESS_DENIED, exception.getStatus());

		// verify: findAllById는 호출되었지만 deleteAll은 호출되지 않음 (all-or-nothing)
		verify(noteRepository, times(1)).findAllById(noteIds);
		verify(noteRepository, never()).deleteAll(anyList());
	}

	// ========================================
	// getRecentNotes 메서드 테스트
	// ========================================

	@Test
	@DisplayName("최근 노트 목록 조회 성공 - 10개 노트가 있는 경우")
	void getRecentNotes_Success_With10Notes() {
		// given: 10개의 노트를 준비
		Long userId = 1L;
		List<Note> notes = new ArrayList<>();

		for (int i = 0; i < 10; i++) {
			Note note = Note.builder()
				.id((long)(i + 1))
				.user(testUser)
				.title("노트 " + (i + 1))
				.content("내용 " + (i + 1))
				.remindCount(0)
				.build();
			notes.add(note);
		}

		given(noteRepository.findRecentByUserId(eq(userId), any(Pageable.class))).willReturn(notes);

		// when: 최근 노트 목록 조회
		List<NoteRecentResponse> result = noteService.getRecentNotes(userId);

		// then: 10개의 노트가 반환됨
		assertNotNull(result);
		assertEquals(10, result.size());
		assertEquals("노트 1", result.get(0).title());
		assertEquals("노트 10", result.get(9).title());

		// verify: Repository 메서드가 올바른 인자로 호출됨
		verify(noteRepository, times(1)).findRecentByUserId(eq(userId), any(Pageable.class));
	}

	@Test
	@DisplayName("최근 노트 목록 조회 성공 - 5개 노트만 있는 경우")
	void getRecentNotes_Success_With5Notes() {
		// given: 5개의 노트만 준비
		Long userId = 1L;
		List<Note> notes = new ArrayList<>();

		for (int i = 0; i < 5; i++) {
			Note note = Note.builder()
				.id((long)(i + 1))
				.user(testUser)
				.title("노트 " + (i + 1))
				.content("내용 " + (i + 1))
				.remindCount(0)
				.build();
			notes.add(note);
		}

		given(noteRepository.findRecentByUserId(eq(userId), any(Pageable.class))).willReturn(notes);

		// when: 최근 노트 목록 조회
		List<NoteRecentResponse> result = noteService.getRecentNotes(userId);

		// then: 5개의 노트가 반환됨
		assertNotNull(result);
		assertEquals(5, result.size());

		verify(noteRepository, times(1)).findRecentByUserId(eq(userId), any(Pageable.class));
	}

	@Test
	@DisplayName("최근 노트 목록 조회 성공 - 노트가 없는 경우 null 반환")
	void getRecentNotes_EmptyList_ReturnsNull() {
		// given: 노트가 없는 경우
		Long userId = 1L;
		given(noteRepository.findRecentByUserId(eq(userId), any(Pageable.class))).willReturn(List.of());

		// when: 최근 노트 목록 조회
		List<NoteRecentResponse> result = noteService.getRecentNotes(userId);

		// then: null이 반환됨 (API 명세 준수)
		assertNull(result);

		verify(noteRepository, times(1)).findRecentByUserId(eq(userId), any(Pageable.class));
	}

	@Test
	@DisplayName("최근 노트 목록 조회 성공 - 단일 노트만 있는 경우")
	void getRecentNotes_Success_WithSingleNote() {
		// given: 단일 노트만 준비
		Long userId = 1L;
		Note singleNote = Note.builder()
			.id(1L)
			.user(testUser)
			.title("유일한 노트")
			.content("유일한 내용")
			.remindCount(0)
			.build();

		given(noteRepository.findRecentByUserId(eq(userId), any(Pageable.class))).willReturn(List.of(singleNote));

		// when: 최근 노트 목록 조회
		List<NoteRecentResponse> result = noteService.getRecentNotes(userId);

		// then: 1개의 노트가 반환됨
		assertNotNull(result);
		assertEquals(1, result.size());
		assertEquals(1L, result.get(0).noteId());
		assertEquals("유일한 노트", result.get(0).title());

		verify(noteRepository, times(1)).findRecentByUserId(eq(userId), any(Pageable.class));
	}

	@Test
	@DisplayName("최근 노트 목록 조회 성공 - PageRequest에 올바른 파라미터 전달")
	void getRecentNotes_Success_CorrectPageableParameters() {
		// given: 노트 준비
		Long userId = 1L;
		List<Note> notes = List.of(
			Note.builder()
				.id(1L)
				.user(testUser)
				.title("노트 1")
				.content("내용 1")
				.remindCount(0)
				.build()
		);

		given(noteRepository.findRecentByUserId(eq(userId), any(Pageable.class))).willReturn(notes);

		// when: 최근 노트 목록 조회
		List<NoteRecentResponse> result = noteService.getRecentNotes(userId);

		// then: 결과 확인
		assertNotNull(result);
		assertEquals(1, result.size());

		// verify: PageRequest.of(0, 10)이 전달되었는지 확인
		verify(noteRepository, times(1)).findRecentByUserId(
			eq(userId),
			eq(PageRequest.of(0, 10))
		);
	}

	@Test
	@DisplayName("최근 노트 목록 조회 성공 - 반환되는 DTO에 noteId와 title만 포함")
	void getRecentNotes_Success_ResponseContainsOnlyNoteIdAndTitle() {
		// given: 노트 준비 (content, remindAt 등 다른 필드도 존재)
		Long userId = 1L;
		LocalDateTime remindTime = LocalDateTime.now().plusDays(1);
		Note noteWithAllFields = Note.builder()
			.id(123L)
			.user(testUser)
			.title("제목만 반환될 노트")
			.content("이 내용은 응답에 포함되지 않아야 함")
			.remindCount(5)
			.remindAt(remindTime)
			.build();

		given(noteRepository.findRecentByUserId(eq(userId), any(Pageable.class)))
			.willReturn(List.of(noteWithAllFields));

		// when: 최근 노트 목록 조회
		List<NoteRecentResponse> result = noteService.getRecentNotes(userId);

		// then: noteId와 title만 포함되어 있는지 확인
		assertNotNull(result);
		assertEquals(1, result.size());
		NoteRecentResponse response = result.get(0);
		assertEquals(123L, response.noteId());
		assertEquals("제목만 반환될 노트", response.title());
		// content, remindAt, remindCount는 NoteRecentResponse에 포함되지 않음

		verify(noteRepository, times(1)).findRecentByUserId(eq(userId), any(Pageable.class));
	}

	@Test
	@DisplayName("최근 노트 목록 조회 성공 - 여러 사용자가 각각 자신의 노트 목록 조회")
	void getRecentNotes_Success_MultipleUsersGetTheirOwnNotes() {
		// given: 두 명의 사용자와 각각의 노트
		Long userId1 = 1L;
		Long userId2 = 2L;

		User user2 = User.builder()
			.id(userId2)
			.email("user2@example.com")
			.name("사용자2")
			.build();

		Note note1 = Note.builder()
			.id(1L)
			.user(testUser)
			.title("사용자1의 노트")
			.content("내용1")
			.remindCount(0)
			.build();

		Note note2 = Note.builder()
			.id(2L)
			.user(user2)
			.title("사용자2의 노트")
			.content("내용2")
			.remindCount(0)
			.build();

		given(noteRepository.findRecentByUserId(eq(userId1), any(Pageable.class)))
			.willReturn(List.of(note1));
		given(noteRepository.findRecentByUserId(eq(userId2), any(Pageable.class)))
			.willReturn(List.of(note2));

		// when: 각 사용자가 자신의 최근 노트 목록 조회
		List<NoteRecentResponse> result1 = noteService.getRecentNotes(userId1);
		List<NoteRecentResponse> result2 = noteService.getRecentNotes(userId2);

		// then: 각자의 노트만 반환됨
		assertNotNull(result1);
		assertNotNull(result2);
		assertEquals(1, result1.size());
		assertEquals(1, result2.size());
		assertEquals("사용자1의 노트", result1.get(0).title());
		assertEquals("사용자2의 노트", result2.get(0).title());

		verify(noteRepository, times(1)).findRecentByUserId(eq(userId1), any(Pageable.class));
		verify(noteRepository, times(1)).findRecentByUserId(eq(userId2), any(Pageable.class));
	}

	@Test
	@DisplayName("최근 노트 목록 조회 성공 - 정확히 10개를 초과하는 경우에도 10개만 반환")
	void getRecentNotes_Success_ExactlyLimitedTo10() {
		// given: Repository가 정확히 10개만 반환하도록 설정 (Pageable 동작 시뮬레이션)
		Long userId = 1L;
		List<Note> exactly10Notes = new ArrayList<>();

		for (int i = 0; i < 10; i++) {
			Note note = Note.builder()
				.id((long)(i + 1))
				.user(testUser)
				.title("노트 " + (i + 1))
				.content("내용 " + (i + 1))
				.remindCount(0)
				.build();
			exactly10Notes.add(note);
		}

		given(noteRepository.findRecentByUserId(eq(userId), any(Pageable.class)))
			.willReturn(exactly10Notes);

		// when: 최근 노트 목록 조회
		List<NoteRecentResponse> result = noteService.getRecentNotes(userId);

		// then: 정확히 10개만 반환됨
		assertNotNull(result);
		assertEquals(10, result.size());

		verify(noteRepository, times(1)).findRecentByUserId(
			eq(userId),
			eq(PageRequest.of(0, 10))
		);
	}

	// ========================================
	// getReminderNotes 메서드 테스트
	// ========================================

	@Test
	@DisplayName("리마인더 노트 목록 조회 성공 - 첫 페이지 10개")
	void getReminderNotes_Success_FirstPage() {
		// given: 리마인더가 켜진 10개의 노트를 준비
		Long userId = 1L;
		int page = 0;
		int size = 10;
		List<Note> reminderNotes = new ArrayList<>();

		for (int i = 0; i < 10; i++) {
			Note note = Note.builder()
				.id((long)(i + 1))
				.user(testUser)
				.title("리마인더 노트 " + (i + 1))
				.content("내용 " + (i + 1))
				.remindCount(0)
				.remindAt(LocalDateTime.now().plusDays(i + 1))
				.build();
			reminderNotes.add(note);
		}

		Page<Note> notePage = new PageImpl<>(reminderNotes, PageRequest.of(page, size), 25);
		given(noteRepository.findReminderNotesByUserId(eq(userId), any(Pageable.class)))
			.willReturn(notePage);

		// when: 리마인더 노트 목록 조회
		NoteReminderResponse result = noteService.getReminderNotes(userId, page, size);

		// then: 페이징 정보와 노트 목록이 올바르게 반환됨
		assertNotNull(result);
		assertEquals(10, result.results().size());
		assertEquals(25, result.totalCount());
		assertEquals(0, result.currentPage());
		assertEquals(3, result.totalPages());
		assertEquals(10, result.pageSize());

		// verify: Repository 메서드가 올바른 인자로 호출됨
		verify(noteRepository, times(1)).findReminderNotesByUserId(
			eq(userId),
			eq(PageRequest.of(page, size))
		);
	}

	@Test
	@DisplayName("리마인더 노트 목록 조회 성공 - 두 번째 페이지")
	void getReminderNotes_Success_SecondPage() {
		// given: 두 번째 페이지의 노트 준비
		Long userId = 1L;
		int page = 1;
		int size = 10;
		List<Note> reminderNotes = new ArrayList<>();

		for (int i = 10; i < 20; i++) {
			Note note = Note.builder()
				.id((long)(i + 1))
				.user(testUser)
				.title("리마인더 노트 " + (i + 1))
				.content("내용 " + (i + 1))
				.remindCount(0)
				.remindAt(LocalDateTime.now().plusDays(i + 1))
				.build();
			reminderNotes.add(note);
		}

		Page<Note> notePage = new PageImpl<>(reminderNotes, PageRequest.of(page, size), 25);
		given(noteRepository.findReminderNotesByUserId(eq(userId), any(Pageable.class)))
			.willReturn(notePage);

		// when: 두 번째 페이지 조회
		NoteReminderResponse result = noteService.getReminderNotes(userId, page, size);

		// then: 두 번째 페이지 데이터가 올바르게 반환됨
		assertNotNull(result);
		assertEquals(10, result.results().size());
		assertEquals(25, result.totalCount());
		assertEquals(1, result.currentPage());
		assertEquals(3, result.totalPages());
		assertEquals(10, result.pageSize());

		verify(noteRepository, times(1)).findReminderNotesByUserId(
			eq(userId),
			eq(PageRequest.of(page, size))
		);
	}

	@Test
	@DisplayName("리마인더 노트 목록 조회 성공 - 마지막 페이지 (5개)")
	void getReminderNotes_Success_LastPage() {
		// given: 마지막 페이지에 5개만 있는 경우
		Long userId = 1L;
		int page = 2;
		int size = 10;
		List<Note> reminderNotes = new ArrayList<>();

		for (int i = 20; i < 25; i++) {
			Note note = Note.builder()
				.id((long)(i + 1))
				.user(testUser)
				.title("리마인더 노트 " + (i + 1))
				.content("내용 " + (i + 1))
				.remindCount(0)
				.remindAt(LocalDateTime.now().plusDays(i + 1))
				.build();
			reminderNotes.add(note);
		}

		Page<Note> notePage = new PageImpl<>(reminderNotes, PageRequest.of(page, size), 25);
		given(noteRepository.findReminderNotesByUserId(eq(userId), any(Pageable.class)))
			.willReturn(notePage);

		// when: 마지막 페이지 조회
		NoteReminderResponse result = noteService.getReminderNotes(userId, page, size);

		// then: 5개만 반환되고 페이징 정보가 올바름
		assertNotNull(result);
		assertEquals(5, result.results().size());
		assertEquals(25, result.totalCount());
		assertEquals(2, result.currentPage());
		assertEquals(3, result.totalPages());
		assertEquals(10, result.pageSize());

		verify(noteRepository, times(1)).findReminderNotesByUserId(
			eq(userId),
			eq(PageRequest.of(page, size))
		);
	}

	@Test
	@DisplayName("리마인더 노트 목록 조회 성공 - 리마인더 노트가 없는 경우")
	void getReminderNotes_Success_EmptyList() {
		// given: 리마인더 노트가 없는 경우
		Long userId = 1L;
		int page = 0;
		int size = 10;

		Page<Note> emptyPage = new PageImpl<>(List.of(), PageRequest.of(page, size), 0);
		given(noteRepository.findReminderNotesByUserId(eq(userId), any(Pageable.class)))
			.willReturn(emptyPage);

		// when: 리마인더 노트 목록 조회
		NoteReminderResponse result = noteService.getReminderNotes(userId, page, size);

		// then: 빈 리스트와 페이징 정보 반환
		assertNotNull(result);
		assertEquals(0, result.results().size());
		assertEquals(0, result.totalCount());
		assertEquals(0, result.currentPage());
		assertEquals(0, result.totalPages());
		assertEquals(10, result.pageSize());

		verify(noteRepository, times(1)).findReminderNotesByUserId(
			eq(userId),
			eq(PageRequest.of(page, size))
		);
	}

	@Test
	@DisplayName("리마인더 노트 목록 조회 성공 - 단일 리마인더 노트")
	void getReminderNotes_Success_SingleNote() {
		// given: 단일 리마인더 노트만 준비
		Long userId = 1L;
		int page = 0;
		int size = 10;
		LocalDateTime remindTime = LocalDateTime.now().plusDays(1);

		Note singleNote = Note.builder()
			.id(1L)
			.user(testUser)
			.title("유일한 리마인더 노트")
			.content("유일한 내용")
			.remindCount(0)
			.remindAt(remindTime)
			.build();

		Page<Note> notePage = new PageImpl<>(List.of(singleNote), PageRequest.of(page, size), 1);
		given(noteRepository.findReminderNotesByUserId(eq(userId), any(Pageable.class)))
			.willReturn(notePage);

		// when: 리마인더 노트 목록 조회
		NoteReminderResponse result = noteService.getReminderNotes(userId, page, size);

		// then: 1개의 노트가 반환됨
		assertNotNull(result);
		assertEquals(1, result.results().size());
		assertEquals(1L, result.results().get(0).noteId());
		assertEquals("유일한 리마인더 노트", result.results().get(0).title());
		assertEquals(1, result.totalCount());
		assertEquals(0, result.currentPage());
		assertEquals(1, result.totalPages());

		verify(noteRepository, times(1)).findReminderNotesByUserId(
			eq(userId),
			eq(PageRequest.of(page, size))
		);
	}

	@Test
	@DisplayName("리마인더 노트 목록 조회 성공 - 다양한 페이지 사이즈 (20개)")
	void getReminderNotes_Success_CustomPageSize() {
		// given: 페이지 사이즈 20으로 조회
		Long userId = 1L;
		int page = 0;
		int size = 20;
		List<Note> reminderNotes = new ArrayList<>();

		for (int i = 0; i < 20; i++) {
			Note note = Note.builder()
				.id((long)(i + 1))
				.user(testUser)
				.title("리마인더 노트 " + (i + 1))
				.content("내용 " + (i + 1))
				.remindCount(0)
				.remindAt(LocalDateTime.now().plusDays(i + 1))
				.build();
			reminderNotes.add(note);
		}

		Page<Note> notePage = new PageImpl<>(reminderNotes, PageRequest.of(page, size), 50);
		given(noteRepository.findReminderNotesByUserId(eq(userId), any(Pageable.class)))
			.willReturn(notePage);

		// when: 페이지 사이즈 20으로 조회
		NoteReminderResponse result = noteService.getReminderNotes(userId, page, size);

		// then: 20개가 반환되고 페이징 정보가 올바름
		assertNotNull(result);
		assertEquals(20, result.results().size());
		assertEquals(50, result.totalCount());
		assertEquals(0, result.currentPage());
		assertEquals(3, result.totalPages());
		assertEquals(20, result.pageSize());

		verify(noteRepository, times(1)).findReminderNotesByUserId(
			eq(userId),
			eq(PageRequest.of(page, size))
		);
	}

	@Test
	@DisplayName("리마인더 노트 목록 조회 성공 - 반환되는 DTO에 noteId와 title만 포함")
	void getReminderNotes_Success_ResponseContainsOnlyNoteIdAndTitle() {
		// given: remindAt, content 등 다른 필드도 있는 노트 준비
		Long userId = 1L;
		int page = 0;
		int size = 10;
		LocalDateTime remindTime = LocalDateTime.now().plusDays(1);

		Note noteWithAllFields = Note.builder()
			.id(123L)
			.user(testUser)
			.title("제목만 반환될 리마인더 노트")
			.content("이 내용은 응답에 포함되지 않아야 함")
			.remindCount(3)
			.remindAt(remindTime)
			.build();

		Page<Note> notePage = new PageImpl<>(List.of(noteWithAllFields), PageRequest.of(page, size), 1);
		given(noteRepository.findReminderNotesByUserId(eq(userId), any(Pageable.class)))
			.willReturn(notePage);

		// when: 리마인더 노트 목록 조회
		NoteReminderResponse result = noteService.getReminderNotes(userId, page, size);

		// then: noteId와 title만 포함되어 있는지 확인
		assertNotNull(result);
		assertEquals(1, result.results().size());
		assertEquals(123L, result.results().get(0).noteId());
		assertEquals("제목만 반환될 리마인더 노트", result.results().get(0).title());
		// content, remindAt, remindCount는 NoteReminderResult에 포함되지 않음

		verify(noteRepository, times(1)).findReminderNotesByUserId(
			eq(userId),
			eq(PageRequest.of(page, size))
		);
	}

	@Test
	@DisplayName("리마인더 노트 목록 조회 성공 - 여러 사용자가 각각 자신의 리마인더 노트 조회")
	void getReminderNotes_Success_MultipleUsersGetTheirOwnNotes() {
		// given: 두 명의 사용자와 각각의 리마인더 노트
		Long userId1 = 1L;
		Long userId2 = 2L;
		int page = 0;
		int size = 10;

		User user2 = User.builder()
			.id(userId2)
			.email("user2@example.com")
			.name("사용자2")
			.build();

		Note note1 = Note.builder()
			.id(1L)
			.user(testUser)
			.title("사용자1의 리마인더 노트")
			.content("내용1")
			.remindCount(0)
			.remindAt(LocalDateTime.now().plusDays(1))
			.build();

		Note note2 = Note.builder()
			.id(2L)
			.user(user2)
			.title("사용자2의 리마인더 노트")
			.content("내용2")
			.remindCount(0)
			.remindAt(LocalDateTime.now().plusDays(2))
			.build();

		Page<Note> page1 = new PageImpl<>(List.of(note1), PageRequest.of(page, size), 1);
		Page<Note> page2 = new PageImpl<>(List.of(note2), PageRequest.of(page, size), 1);

		given(noteRepository.findReminderNotesByUserId(eq(userId1), any(Pageable.class)))
			.willReturn(page1);
		given(noteRepository.findReminderNotesByUserId(eq(userId2), any(Pageable.class)))
			.willReturn(page2);

		// when: 각 사용자가 자신의 리마인더 노트 목록 조회
		NoteReminderResponse result1 = noteService.getReminderNotes(userId1, page, size);
		NoteReminderResponse result2 = noteService.getReminderNotes(userId2, page, size);

		// then: 각자의 리마인더 노트만 반환됨
		assertNotNull(result1);
		assertNotNull(result2);
		assertEquals(1, result1.results().size());
		assertEquals(1, result2.results().size());
		assertEquals("사용자1의 리마인더 노트", result1.results().get(0).title());
		assertEquals("사용자2의 리마인더 노트", result2.results().get(0).title());

		verify(noteRepository, times(1)).findReminderNotesByUserId(
			eq(userId1),
			eq(PageRequest.of(page, size))
		);
		verify(noteRepository, times(1)).findReminderNotesByUserId(
			eq(userId2),
			eq(PageRequest.of(page, size))
		);
	}
}
