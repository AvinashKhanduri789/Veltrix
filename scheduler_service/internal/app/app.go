package app

import (
	"context"
	"log"
	"os"
	"strings"

	eventspb "veltrix/proto/eventspb"
	"veltrix/scheduler_service/internal/db"
	"veltrix/scheduler_service/internal/kafka"
	"veltrix/scheduler_service/internal/repository"
	"veltrix/scheduler_service/internal/services"
	transportgrpc "veltrix/scheduler_service/internal/transport/grpc"
)

func parseBrokers(raw string) []string {
	if raw == "" {
		return []string{"localhost:9092"}
	}

	parts := strings.Split(raw, ",")
	brokers := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			brokers = append(brokers, trimmed)
		}
	}
	if len(brokers) == 0 {
		return []string{"localhost:9092"}
	}
	return brokers
}

func Run(ctx context.Context, grpcPort int) error {
	mongoStore, err := db.NewMongoStore(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = mongoStore.Close(context.Background())
	}()

	brokers := parseBrokers(os.Getenv("KAFKA_BROKERS"))
	kafkaTopic := os.Getenv("KAFKA_TOPIC")
	if kafkaTopic == "" {
		kafkaTopic = "execution-jobs"
	}

	executionRepo := repository.NewExecutionRepository(mongoStore.Database)
	versionRepo := repository.NewVersionRepository(mongoStore.Database)
	producer := kafka.NewProducer(brokers, kafkaTopic)
	defer func() {
		_ = producer.Close()
	}()

	schedulerService := services.NewSchedulerService(executionRepo, versionRepo, producer)

	consumer := kafka.NewConsumer(
		brokers,
		"execution-events",
		"scheduler-service",
	)
	defer func() {
		_ = consumer.Close()
	}()

	go consumer.Start(ctx, func(event *eventspb.ExecutionEvent) error {
		return schedulerService.HandleExecutionEvent(ctx, event)
	})

	handler := transportgrpc.NewSchedulerHandler(schedulerService)
	server := transportgrpc.NewGrpcServer(grpcPort, handler)

	log.Printf("scheduler app started (grpcPort=%d)", grpcPort)
	server.Start()
	return nil
}
