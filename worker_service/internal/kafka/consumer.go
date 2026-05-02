package kafka

import (
	"context"
	"log"

	kgo "github.com/segmentio/kafka-go"
	"google.golang.org/protobuf/proto"
	eventspb "veltrix/proto/eventspb"
)

type KafkaConsumer struct {
	kgo *kgo.Reader
}

func NewKafkaConsumer(brokerList []string, topic string, groupID string) *KafkaConsumer {

	return &KafkaConsumer{
		kgo: kgo.NewReader(
			kgo.ReaderConfig{
				Brokers:  brokerList,
				Topic:    topic,
				GroupID:  groupID,
				MinBytes: 10e3,
				MaxBytes: 10e6,
			}),
	}
}

func (k *KafkaConsumer) Start(ctx context.Context, handler func(pb *eventspb.ExecutionJob) error) {

	for {

		select {
		case <-ctx.Done():
			log.Println("consumer shutting down")
			return
		default:
		}

		message, err := k.kgo.FetchMessage(ctx)

		if err != nil {
			log.Printf("Error while fetching messeges from execution-job topic %v", err)
			continue
		}

		var event eventspb.ExecutionJob

		if err := proto.Unmarshal(message.Value, &event); err != nil {
			log.Printf("Error while converting proto bytes to ExecutionJob payload %v", err)
			k.kgo.CommitMessages(ctx,message)
			continue
		}

		if err := handler(&event); err != nil {
			log.Printf("Error while handling ExecutionJob payload %v", err)
			continue
		}

		if err := k.kgo.CommitMessages(ctx, message); err != nil {
			log.Print("Error while committing offset to kafka execution-job topic")
		}

	}

}

func (k *KafkaConsumer) Close() error {
	if k == nil || k.kgo == nil {
		return nil
	}

	if err := k.kgo.Close(); err != nil {
		log.Printf("Error while closing the worker kafka consumer %v", err)
	}

	return nil
}
