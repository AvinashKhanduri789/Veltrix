package app

import (
	"context"
	"log"

	"google.golang.org/protobuf/proto"

	logspb "veltrix/proto/logspb"
	"veltrix/logs_service/internal/config"
	"veltrix/logs_service/internal/kafka"
	"veltrix/logs_service/internal/services"
	grpcserver "veltrix/logs_service/internal/transport/grpc"
)

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{
		ctx: context.Background(),
	}
}

func (a *App) Run() {
	cfg := config.Load()

	log.Printf("🚀 LogsService starting | topic=%s broker=%s",
	cfg.LogsTopic,
	cfg.KafkaBrokers,
)

	streamService := service.NewLogStreamService()	

	consumer := kafka.NewConsumer(
		[]string{cfg.KafkaBrokers},
		cfg.LogsTopic,
		"logs-service-group",
	)

	// Kafka → Publish to stream
	go consumer.Start(a.ctx, func(msg []byte) {
		defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 PANIC in log handler: %v", r)
		}
	}()

	log.Printf("📦 RAW KAFKA MESSAGE (%d bytes): %v", len(msg), msg)

	var event logspb.LogEvent
	if err := proto.Unmarshal(msg, &event); err != nil {
		log.Printf("❌ UNMARSHAL FAILED: %v", err)

		// 🔥 try decoding as STRING (debug trick)
		log.Printf("🧪 RAW AS STRING: %s", string(msg))

		return
	}

	log.Printf("✅ LOG EVENT RECEIVED: executionId=%s message=%s",
		event.ExecutionId,
		event.Message,
	)

	streamService.Publish(&event)
})

	// Start gRPC
	grpcserver.StartGRPCServer(cfg.GrpcPort, streamService)
}