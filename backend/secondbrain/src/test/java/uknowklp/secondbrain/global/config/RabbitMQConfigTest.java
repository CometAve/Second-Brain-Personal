package uknowklp.secondbrain.global.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RabbitMQConfigTest {
	@Test
	void usesConfiguredQueueNameForBinding() {
		var config = new RabbitMQConfig();
		var queue = config.noteCreationQueue("note_creation_queue_gemini");
		var binding = config.noteEventsBinding(queue, config.knowledgeGraphExchange());
		assertThat(queue.getName()).isEqualTo("note_creation_queue_gemini");
		assertThat(binding.getDestination()).isEqualTo("note_creation_queue_gemini");
	}
}
