package kafka

import (
	"context"
	"log"

	kgo "github.com/segmentio/kafka-go"
	"google.golang.org/protobuf/proto"
	eventspb "veltrix/proto/eventspb"
)

type Consumer struct {
	reader *kgo.Reader
}

func NewConsumer(brokers []string, topic string, groupID string) *Consumer {
	return &Consumer{
		reader: kgo.NewReader(kgo.ReaderConfig{
			Brokers:  brokers,
			Topic:    topic,
			GroupID:  groupID,
			MinBytes: 10e3,
			MaxBytes: 10e6,
		}),
	}
}

func (c *Consumer) Start(ctx context.Context, handler func(event *eventspb.ExecutionEvent) error) {
	for {
		msg, err := c.reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("kafka consumer read error: %v", err)
			continue
		}

		var event eventspb.ExecutionEvent
		if err := proto.Unmarshal(msg.Value, &event); err != nil {
			log.Printf("kafka consumer unmarshal error: %v", err)
			continue
		}

		if err := handler(&event); err != nil {
			log.Printf("kafka consumer handler error: %v", err)
		}
	}
}

func (c *Consumer) Close() error {
	if c == nil || c.reader == nil {
		return nil
	}
	return c.reader.Close()
}
