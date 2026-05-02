package app

import (
	"context"
	"log"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/redis/go-redis/v9"
	eventspb "veltrix/proto/eventspb"
	"veltrix/worker_service/internal/codefetcher"
	"veltrix/worker_service/internal/config"
	"veltrix/worker_service/internal/kafka"
	"veltrix/worker_service/internal/runtime"
	"veltrix/worker_service/internal/service"
	"veltrix/worker_service/internal/workerpool"

	"google.golang.org/grpc"
	runtimepb "veltrix/proto/runtimepb"
)

type App struct {
	ctx    context.Context
	cancel context.CancelFunc
}

func NewApp() *App {
	ctx, cancel := context.WithCancel(context.Background())
	return &App{ctx: ctx, cancel: cancel}
}

func (a *App) Run() {

	// ================= CONFIG =================

	cfg := config.Load()

	brokers := []string{cfg.KafkaBrokers}

	executionTopic := "execution-jobs"
	retryTopic := "execution-jobs-retry"
	dlqTopic := "execution-dlq"
	logsTopic := "execution-logs"

	// ================= PRODUCERS =================

	executionProducer := kafka.NewKafkaProducer(brokers, executionTopic)
	retryProducer := kafka.NewKafkaProducer(brokers, retryTopic)
	dlqProducer := kafka.NewKafkaProducer(brokers, dlqTopic)
	logsProducer := kafka.NewKafkaProducer(brokers, logsTopic)
	eventProducer := kafka.NewKafkaProducer(brokers, "execution-events")

	// ================= CONSUMERS =================

	executionConsumer := kafka.NewKafkaConsumer(brokers, executionTopic, "worker-group")
	retryConsumer := kafka.NewKafkaConsumer(brokers, retryTopic, "retry-group")

	// ================= RUNTIME =================

	pythonConn := mustDial(cfg.PythonRuntimeAddr)
	// nodeConn := mustDial("localhost:50052")

	router := runtime.NewRuntimeRouter(map[string]runtimepb.RuntimeExecutionServiceClient{
		"python-3.10": runtimepb.NewRuntimeExecutionServiceClient(pythonConn),
		// "node":   runtimepb.NewRuntimeExecutionServiceClient(nodeConn),
	})

	// ================= FETCHER =================
	redisClient := redis.NewClient(&redis.Options{
		Addr: cfg.RedisAddr,
	})

	redisStore := codefetcher.NewRedisStore(redisClient)

	minioClient, err := minio.New(config.Load().MinioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4("minioadmin", "minioadmin", ""),
		Secure: false,
	})
	if err != nil {
		log.Fatalf("failed to init minio: %v", err)
	}

	minioFetcher := codefetcher.NewMinIOFetcher(minioClient, "code-bucket")

	cacheFetcher := codefetcher.NewCacheCodeFetcher(redisStore, minioFetcher)

	// ================= SERVICES =================

	executionService := service.NewExecutionService(
		"worker-1",
		cacheFetcher,
		router,
		retryProducer,
		logsProducer,
		eventProducer,
	)

	retryService := service.NewRetryService(
		executionProducer,
		dlqProducer,
		eventProducer,
		3,
	)

	// ================= WORKER POOL =================

	pool := workerpool.NewWorkerPool(5, 50, executionService.HandleExecution)
	pool.Start(a.ctx)

	// ================= EXECUTION FLOW =================

	go executionConsumer.Start(a.ctx, func(job *eventspb.ExecutionJob) error {
		pool.Submit(job)
		return nil
	})

	// ================= RETRY FLOW =================

	go retryConsumer.Start(a.ctx, func(job *eventspb.ExecutionJob) error {
		retryService.HandleRetry(a.ctx, job)
		return nil
	})

	log.Println("Worker started")

	<-a.ctx.Done()

	log.Println("shutting down...")

	pool.Stop()
	time.Sleep(2 * time.Second)
}

func (a *App) Stop() {
	a.cancel()
}

func mustDial(addr string) *grpc.ClientConn {
	conn, err := grpc.Dial(addr, grpc.WithInsecure())
	if err != nil {
		log.Fatalf("failed to connect runtime: %v", err)
	}
	return conn
}
