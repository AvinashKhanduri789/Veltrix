package service

import (
	"context"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	eventspb "veltrix/proto/eventspb"
	runtimepb "veltrix/proto/runtimepb"
	"veltrix/worker_service/internal/codefetcher"
	"veltrix/worker_service/internal/kafka"
	router "veltrix/worker_service/internal/runtime"

	"google.golang.org/grpc/status"
)

// =========================
// ExecutionService
// =========================

type ExecutionService struct {
	workerID          string
	cachedCodeFetcher *codefetcher.CacheCodeFetcher
	router            *router.RuntimeRouter

	retryProducer *kafka.KafkaProducer
	logsProducer  *kafka.KafkaProducer
	eventProducer *kafka.KafkaProducer 
}

func NewExecutionService(
	workerID string,
	cachedCodeFetcher *codefetcher.CacheCodeFetcher,
	router *router.RuntimeRouter,
	retryProducer *kafka.KafkaProducer,
	logsProducer *kafka.KafkaProducer,
	eventProducer *kafka.KafkaProducer,
) *ExecutionService {
	return &ExecutionService{
		workerID:          workerID,
		cachedCodeFetcher: cachedCodeFetcher,
		router:            router,
		retryProducer:     retryProducer,
		logsProducer:      logsProducer,
		eventProducer:     eventProducer,
	}
}

// =========================
// MAIN HANDLER
// =========================

func (s *ExecutionService) HandleExecution(ctx context.Context, job *eventspb.ExecutionJob) {

	defer func() {
		if r := recover(); r != nil {
			log.Printf("panic in execution: executionId=%s err=%v", job.ExecutionId, r)
			s.publishRetry(ctx, job, "panic occurred")
		}
	}()

	log.Printf("execution started: executionId=%s worker=%s", job.ExecutionId, s.workerID)

	//  START EVENT
	s.publishStartedEvent(ctx, job)

	//  VALIDATION
	if err := s.validate(job); err != nil {
		s.publishFailureEvent(ctx, job, err.Error())
		return
	}

	//  EXECUTE
	result, err := s.execute(ctx, job)

	if err != nil {

		log.Printf("execution error: executionId=%s err=%v", job.ExecutionId, err)

		if isInfraError(err) {
			s.publishFailureEvent(ctx, job, "requested service not available")
			return
		}

		if isRetryable(err) {
			s.publishRetry(ctx, job, err.Error())
			return
		}

		s.publishFailureEvent(ctx, job, err.Error())
		return
	}

	//  SUCCESS
	s.publishSuccessEvent(ctx, job, result)
}

// =========================
// EXECUTION CORE
// =========================

func (s *ExecutionService) execute(parentCtx context.Context, job *eventspb.ExecutionJob) (string, error) {

	ctx, cancel := context.WithTimeout(parentCtx, time.Duration(job.TimeoutSeconds)*time.Second)
	defer cancel()

	// FETCH CODE
	code, err := s.cachedCodeFetcher.Fetch(ctx, job.CodeStoragePath)
	if err != nil {
		return "", fmt.Errorf("code fetch failed: %w", err)
	}

	//  RUNTIME CLIENT
	client, err := s.router.GetClient(job.Runtime)
	if err != nil {
		return "", fmt.Errorf("unsupported runtime: %w", err)
	}

	stream, err := client.ExecuteExecution(ctx)
	if err != nil {
		return "", err
	}
	defer stream.CloseSend()

	//  SEND REQUEST
	req := &runtimepb.ExecutionRequest{
		Payload: &runtimepb.ExecutionRequest_Start{
			Start: &runtimepb.ExecutionStart{
				ExecutionId:    job.ExecutionId,
				UserId:         job.UserId,
				FunctionId:     job.FunctionId,
				VersionId:      job.VersionId,
				Runtime:        job.Runtime,
				InputPayload:   job.InputPayload,
				TimeoutSeconds: job.TimeoutSeconds,
				MemoryLimitMb:  128,
				CodeBundle:     code,
			},
		},
	}

	if err := stream.Send(req); err != nil {
		return "", err
	}

	// RECEIVE LOOP
	var finalOutput strings.Builder

	for {
		res, err := stream.Recv()

		if err == io.EOF {
			break
		}

		if err != nil {
			if ctx.Err() == context.DeadlineExceeded {
				return "", fmt.Errorf("timeout: %w", err)
			}

			if _, ok := status.FromError(err); ok && isRetryable(err) {
				return "", fmt.Errorf("retryable: %w", err)
			}

			return "", err
		}

		switch x := res.Payload.(type) {

		case *runtimepb.ExecutionResponse_Log:
			log.Printf("EXEC LOG [%s]: %s", job.ExecutionId, x.Log.Message)
			finalOutput.WriteString(x.Log.Message + "\n")

		case *runtimepb.ExecutionResponse_Result:
			log.Printf("EXEC RESULT [%s]", job.ExecutionId)

			if x.Result.ErrorMessage != "" {
				return "", fmt.Errorf("runtime error: %s", x.Result.ErrorMessage)
			}

			return finalOutput.String(), nil // 🔥 STOP HERE (IMPORTANT FIX)
		}
	}

	return finalOutput.String(), nil
}

// =========================
// EVENTS
// =========================

func (s *ExecutionService) publishStartedEvent(ctx context.Context, job *eventspb.ExecutionJob) {
	event := &eventspb.ExecutionEvent{
		ExecutionId: job.ExecutionId,
		WorkerId:    s.workerID,
		EventType:   eventspb.ExecutionEventType_EXECUTION_STARTED,
		Timestamp:   time.Now().UnixMilli(),
	}

	_ = s.eventProducer.ProduceExecutionEvent(ctx, event)
}

func (s *ExecutionService) publishSuccessEvent(ctx context.Context, job *eventspb.ExecutionJob, output string) {
	event := &eventspb.ExecutionEvent{
		ExecutionId: job.ExecutionId,
		WorkerId:    s.workerID,
		EventType:   eventspb.ExecutionEventType_EXECUTION_COMPLETED,
		Timestamp:   time.Now().UnixMilli(),
		Output:      output,
	}

	_ = s.eventProducer.ProduceExecutionEvent(ctx, event)
}

func (s *ExecutionService) publishFailureEvent(ctx context.Context, job *eventspb.ExecutionJob, message string) {
	event := &eventspb.ExecutionEvent{
		ExecutionId:  job.ExecutionId,
		WorkerId:     s.workerID,
		EventType:    eventspb.ExecutionEventType_EXECUTION_FAILED,
		Timestamp:    time.Now().UnixMilli(),
		ErrorMessage: message,
	}

	_ = s.eventProducer.ProduceExecutionEvent(ctx, event)
}

func (s *ExecutionService) publishRetry(ctx context.Context, job *eventspb.ExecutionJob, reason string) {
	job.RetryCount++

	log.Printf("retrying executionId=%s retry=%d reason=%s",
		job.ExecutionId, job.RetryCount, reason)

	_ = s.retryProducer.ProduceExecutionJob(ctx, job)
}

// =========================
// HELPERS
// =========================

func (s *ExecutionService) validate(job *eventspb.ExecutionJob) error {
	if job.ExecutionId == "" {
		return fmt.Errorf("execution_id missing")
	}
	if job.Runtime == "" {
		return fmt.Errorf("runtime missing")
	}
	if job.CodeStoragePath == "" {
		return fmt.Errorf("code storage path missing")
	}
	return nil
}

func isInfraError(err error) bool {
	return strings.Contains(err.Error(), "unsupported runtime")
}

func isRetryable(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "timeout") || strings.Contains(msg, "DeadlineExceeded") || strings.Contains(msg, "connection refused")
}
