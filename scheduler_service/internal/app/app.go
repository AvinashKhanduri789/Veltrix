package app

import (
	"context"
	"log"
	"time"

	eventspb "veltrix/proto/eventspb"
	"veltrix/scheduler_service/internal/config"
	"veltrix/scheduler_service/internal/db"
	"veltrix/scheduler_service/internal/kafka"
	"veltrix/scheduler_service/internal/repository"
	"veltrix/scheduler_service/internal/services"
	transportgrpc "veltrix/scheduler_service/internal/transport/grpc"
)

func Run(ctx context.Context) error {

	cfg := config.Load()

	// =========================
	// Mongo setup
	// =========================
	mongoStore, err := db.NewMongoStore(ctx)
	if err != nil {
		return err
	}

	// =========================
	//  Repositories
	// =========================
	executionRepo := repository.NewExecutionRepository(mongoStore.Database)
	versionRepo := repository.NewVersionRepository(mongoStore.Database)

	// =========================
	//  Kafka Producer
	// =========================
	producer := kafka.NewProducer(cfg.KafkaBrokers, cfg.JobTopic)

	// =========================
	//  Service Layer
	// =========================
	schedulerService := services.NewSchedulerService(
		executionRepo,
		versionRepo,
		producer,
	)

	// =========================
	// Kafka Consumer (execution-events)
	// =========================
	consumer := kafka.NewConsumer(cfg.KafkaBrokers, cfg.EventTopic, cfg.GroupID)

	go consumer.Start(
		ctx,
		func(event *eventspb.ExecutionEvent) error {
			return schedulerService.HandleExecutionEvent(context.Background(), event)
		},
	)

	// =========================
	//  gRPC Server
	// =========================
	handler := transportgrpc.NewSchedulerHandler(schedulerService)
	server := transportgrpc.NewGrpcServer(cfg.GRPCPort, handler)

	go func() {
		log.Printf("scheduler gRPC server started (port=%d)", cfg.GRPCPort)
		server.Start()
	}()

	// =========================
	// Wait for shutdown
	// =========================
	<-ctx.Done()

	log.Println("shutting down scheduler service...")

	// =========================
	//  Cleanup
	// =========================

	if err := consumer.Close(); err != nil {
		log.Printf("error closing consumer: %v", err)
	}

	if err := producer.Close(); err != nil {
		log.Printf("error closing producer: %v", err)
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := mongoStore.Close(shutdownCtx); err != nil {
		log.Printf("error closing mongo: %v", err)
	}

	log.Println("scheduler service stopped cleanly")

	return nil
}