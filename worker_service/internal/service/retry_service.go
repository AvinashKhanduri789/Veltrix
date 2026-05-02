package service

import (
	"context"
	"log"
	"time"

	eventspb "veltrix/proto/eventspb"
	"veltrix/worker_service/internal/kafka"
)

type RetryService struct {
	mainProducer  *kafka.KafkaProducer // execution-jobs
	dlqProducer   *kafka.KafkaProducer // execution-dlq
	eventProducer *kafka.KafkaProducer // execution-events
	maxRetries    int32
}

func NewRetryService(
	mainProducer *kafka.KafkaProducer,
	dlqProducer *kafka.KafkaProducer,
	eventProducer *kafka.KafkaProducer,
	maxRetries int32,
) *RetryService {
	return &RetryService{
		mainProducer:  mainProducer,
		dlqProducer:   dlqProducer,
		eventProducer: eventProducer,
		maxRetries:    maxRetries,
	}
}

func (r *RetryService) HandleRetry(ctx context.Context, job *eventspb.ExecutionJob) {

	log.Printf("retry received executionId=%s retry=%d", job.ExecutionId, job.RetryCount)

	if job.RetryCount >= r.maxRetries {

		log.Printf("max retries reached → DLQ executionId=%s", job.ExecutionId)

		if err := r.dlqProducer.ProduceExecutionJob(ctx, job); err != nil {
			log.Printf("failed to publish DLQ: %v", err)
		}

		event := &eventspb.ExecutionEvent{
			ExecutionId:  job.ExecutionId,
			WorkerId:     "worker-1",
			EventType:    eventspb.ExecutionEventType_EXECUTION_FAILED,
			Timestamp:    time.Now().UnixMilli(),
			ErrorMessage: "max retries exceeded",
		}

		log.Printf("publishing FINAL failure event executionId=%s", job.ExecutionId)

		if err := r.eventProducer.ProduceExecutionEvent(ctx, event); err != nil {
			log.Printf("failed to publish final failure event: %v", err)
		}

		return
	}

	delay := time.Duration(job.RetryCount*2) * time.Second

	go func(j *eventspb.ExecutionJob) {
		select {
		case <-time.After(delay):

			log.Printf("requeue executionId=%s retry=%d", j.ExecutionId, j.RetryCount)

			if err := r.mainProducer.ProduceExecutionJob(ctx, j); err != nil {
				log.Printf("failed to requeue job: %v", err)
			}

		case <-ctx.Done():
			log.Printf("retry cancelled: executionId=%s", j.ExecutionId)
		}
	}(job)
}
