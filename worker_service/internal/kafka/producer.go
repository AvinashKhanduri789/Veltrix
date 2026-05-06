package kafka

import (
	"context"
	"veltrix/proto/eventspb"
	"veltrix/proto/logspb"
	kgo "github.com/segmentio/kafka-go"
	"google.golang.org/protobuf/proto"
)


type KafkaProducer struct{
	producer *kgo.Writer
}

func NewKafkaProducer(brokerList []string  , topic string) (*KafkaProducer){
	return &KafkaProducer{
		producer : &kgo.Writer{
			Addr:     kgo.TCP(brokerList...),
			Topic:    topic,
			Balancer: &kgo.LeastBytes{},
		},
	}
}


func (p *KafkaProducer) ProduceExecutionEvent(ctx context.Context,event *eventspb.ExecutionEvent ) error {
	payload,err := proto.Marshal(event)

	if err != nil{
		return  err
	}

	return p.producer.WriteMessages(ctx, kgo.Message{
		Key:   []byte(event.ExecutionId),
		Value: payload,
	})

}

func (p *KafkaProducer) ProduceExecutionJob(ctx context.Context, job *eventspb.ExecutionJob) error {
	payload, err := proto.Marshal(job)
	if err != nil {
		return err
	}

	return p.producer.WriteMessages(ctx, kgo.Message{
		Key:   []byte(job.ExecutionId),
		Value: payload,
	})
}

func (p *KafkaProducer) ProduceLogEvent(ctx context.Context, event *logspb.LogEvent) error {
	payload, err := proto.Marshal(event)
	if err != nil {
		return err
	}

	return p.producer.WriteMessages(ctx, kgo.Message{
		Key:   []byte(event.ExecutionId),
		Value: payload,
	})
}