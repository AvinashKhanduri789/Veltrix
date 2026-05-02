package service

import (
	"context"
	"log"
	eventspb "veltrix/proto/eventspb"
	kgo "github.com/segmentio/kafka-go"
	// "google.golang.org/grpc/channelz/service"
	"google.golang.org/protobuf/proto"
	// service "veltrix/worker_service/internal/service"
)

type RetryConsumer struct {
	reader  *kgo.Reader
	service *RetryService
}

func NewRetryConsumer(reader *kgo.Reader, service *RetryService) *RetryConsumer {
	return &RetryConsumer{
		reader:  reader,
		service: service,
	}
}

func (c *RetryConsumer) Start(ctx context.Context) {

	for {
		msg, err := c.reader.FetchMessage(ctx)
		if err != nil {
			log.Printf("retry fetch error: %v", err)
			continue
		}

		var job eventspb.ExecutionJob

		if err := proto.Unmarshal(msg.Value, &job); err != nil {
			log.Printf("invalid retry message: %v", err)
			c.reader.CommitMessages(ctx, msg)
			continue
		}

		c.service.HandleRetry(ctx, &job)
		
		

		c.reader.CommitMessages(ctx, msg)
	}
}