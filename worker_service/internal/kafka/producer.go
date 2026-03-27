package kafka

import (
	"context"
	"time"
	kgo "github.com/segmentio/kafka-go"
	"google.golang.org/protobuf/proto"
	enventpb "veltrix/proto/eventspb"
)


type KafkaConsumer struct{
	jobWrite *kgo.Writer
	eventWriter *kgo.Writer
}


func (KafkaConsumer) NewKafkaConsumer(jr *kgo.WriteErrors , er *kgo.Writer) (*KafkaConsumer){
	return &KafkaConsumer{
		jr,
		er,
	}
}