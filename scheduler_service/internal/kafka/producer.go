package kafka

import (
	"context"
	kgo "github.com/segmentio/kafka-go"
	"google.golang.org/protobuf/proto"
	eventspb "veltrix/proto/eventspb"
)

type Producer struct {
	jobWriter   *kgo.Writer
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

func (p *Producer) PublishExecutionCancel(ctx context.Context, executionId string) error {
	event := &eventspb.ExecutionJob{
		ExecutionId: executionId,
		JobType: eventspb.JobType_CANCEL,
	}

	payload, err := proto.Marshal(event)
	if err != nil {
		return err
	}

	return p.jobWriter.WriteMessages(ctx, kgo.Message{
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
	return nil
}
