package kafka

import (
	"context"
	"time"

	kgo "github.com/segmentio/kafka-go"
	"google.golang.org/protobuf/proto"
	eventspb "veltrix/proto/eventspb"
)

type Producer struct {
	jobWriter   *kgo.Writer
	eventWriter *kgo.Writer
}

func NewProducer(brokers []string, topic string) *Producer {
	if topic == "" {
		topic = "execution-jobs"
	}

	return &Producer{
		jobWriter: &kgo.Writer{
			Addr:     kgo.TCP(brokers...),
			Topic:    topic,
			Balancer: &kgo.LeastBytes{},
		},
		eventWriter: &kgo.Writer{
			Addr:     kgo.TCP(brokers...),
			Topic:    "execution-events",
			Balancer: &kgo.LeastBytes{},
		},
	}
}

func (p *Producer) PublishExecutionJob(ctx context.Context, job *eventspb.ExecutionJob) error {
	payload, err := proto.Marshal(job)
	if err != nil {
		return err
	}

	return p.jobWriter.WriteMessages(ctx, kgo.Message{
		Key:   []byte(job.ExecutionId),
		Value: payload,
	})
}

func (p *Producer) PublishExecutionCancel(ctx context.Context, executionId string, userId string) error {
	event := &eventspb.ExecutionEvent{
		ExecutionId: executionId,
		WorkerId:    userId,
		EventType:   eventspb.ExecutionEventType_EXECUTION_CANCELLED,
		Timestamp:   time.Now().UTC().Format(time.RFC3339Nano),
	}

	payload, err := proto.Marshal(event)
	if err != nil {
		return err
	}

	return p.eventWriter.WriteMessages(ctx, kgo.Message{
		Key:   []byte(executionId),
		Value: payload,
	})
}

func (p *Producer) Close() error {
	if p.jobWriter != nil {
		if err := p.jobWriter.Close(); err != nil {
			return err
		}
	}
	if p.eventWriter != nil {
		return p.eventWriter.Close()
	}
	return nil
}
