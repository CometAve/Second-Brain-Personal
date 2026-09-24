package uknowklp.secondbrain.global.config;


import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;

@Configuration
@EnableRabbit
public class RabbitMQConfig {

	// Json 메시지 변환기
	@Bean
	public MessageConverter jsonMessageConverter(){
		return new JacksonJsonMessageConverter();
	}

	// RabbitTemplate 설정
	@Bean
	public RabbitTemplate rabbitTemplate(
		ConnectionFactory connectionFactory,
		MessageConverter jsonMessageConverter
	) {
		RabbitTemplate template = new RabbitTemplate(connectionFactory);
		template.setMessageConverter(jsonMessageConverter);
		return template;
	}

	// 노트 생성 이벤트 큐 (FastAPI Consumer가 사용 중)
	@Bean
	public Queue noteCreationQueue(){
		return QueueBuilder.durable("note_creation_queue")
			.build();
	}

	// 지식 그래프 이벤트용 Topic Exchange
	@Bean
	public TopicExchange knowledgeGraphExchange(){
		return new TopicExchange("knowledge_graph_events", true, false);
	}

	// note.* 바인딩 (created, updated, deleted 모두 포함)
	@Bean
	public Binding noteEventsBinding(Queue noteCreationQueue, TopicExchange knowledgeGraphExchange){
		return BindingBuilder
			.bind(noteCreationQueue)
			.to(knowledgeGraphExchange)
			.with("note.*");
	}
}
