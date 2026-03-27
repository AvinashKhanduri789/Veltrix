package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	eventspb "veltrix/proto/eventspb"
	schedulerpb "veltrix/proto/schedulerpb"
	"veltrix/scheduler_service/internal/constants"
	"veltrix/scheduler_service/internal/domain"
	"veltrix/scheduler_service/internal/kafka"
	"veltrix/scheduler_service/internal/repository"
)

type SchedulerService struct {
	executionRepo    *repository.ExecutionRepository
	versionRepo      *repository.VersionRepository
	producer         *kafka.Producer
	executionCreator *ExecutionService
}

func NewSchedulerService(
	executionRepo *repository.ExecutionRepository,
	versionRepo *repository.VersionRepository,
	producer *kafka.Producer,
) *SchedulerService {
	return &SchedulerService{
		executionRepo:    executionRepo,
		versionRepo:      versionRepo,
		producer:         producer,
		executionCreator: NewExecutionService(executionRepo, producer),
	}
}

func (s *SchedulerService) TriggerExecution(ctx context.Context, req *schedulerpb.TriggerExecutionRequest) (string, error) {
	return s.executionCreator.CreateExecution(ctx, req)
}

func (s *SchedulerService) ReplayExecution(ctx context.Context, req *schedulerpb.ReplayExecutionRequest) (string, error) {
	previousExecutionID, err := primitive.ObjectIDFromHex(req.ExecutionId)

	if req.ExecutionId==""{
		return "",fmt.Errorf("Invalid ExecutionId")
	}
	if err != nil {
		return "", fmt.Errorf("invalid execution id: %w", err)
	}

	previousExecution, err := s.executionRepo.GetExecutionByID(ctx, previousExecutionID)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return "", fmt.Errorf("execution not found")
		}
		return "", err
	}

	inputPayload := previousExecution.InputPayload
	if req.InputOverride != "" {
		overridePayload := bson.M{}
		if err := json.Unmarshal([]byte(req.InputOverride), &overridePayload); err != nil {
			return "", fmt.Errorf("invalid input override: %w", err)
		}
		inputPayload = overridePayload
	}

	newExecution := &domain.Execution{
		ID:                primitive.NewObjectID(),
		UserId:            previousExecution.UserId,
		FunctionId:        previousExecution.FunctionId,
		FunctionVersionId: previousExecution.FunctionVersionId,
		TriggerType:       "REPLAY",
		ReplayOf:          &previousExecution.ID,
		Status:            constants.StatusPending,
		InputPayload:      inputPayload,
		RuntimeVersion:    previousExecution.RuntimeVersion,
		ContainerImageTag: previousExecution.ContainerImageTag,
		TimeoutMs:         previousExecution.TimeoutMs,
		MemoryLimitMb:     previousExecution.MemoryLimitMb,
		CreatedAt:         time.Now(),
	}

	if err := s.executionRepo.CreateExecution(ctx, newExecution); err != nil {
		return "", err
	}

	version, err := s.versionRepo.GetByID(ctx, newExecution.FunctionVersionId)
	if err != nil {
		return "", err
	}

	inputPayloadBytes, err := json.Marshal(newExecution.InputPayload)
	if err != nil {
		return "", err
	}

	job := &eventspb.ExecutionJob{
		ExecutionId:     newExecution.ID.Hex(),
		UserId:          newExecution.UserId.Hex(),
		FunctionId:      newExecution.FunctionId.Hex(),
		VersionId:       newExecution.FunctionVersionId.Hex(),
		CodeStoragePath: version.CodeStoragePath,
		Runtime:         newExecution.RuntimeVersion,
		InputPayload:    string(inputPayloadBytes),
		TimeoutSeconds:  int32(newExecution.TimeoutMs / 1000),
	}

	if err := s.producer.PublishExecutionJob(ctx, job); err != nil {
		_ = s.executionRepo.UpdateExecutionStatus(ctx, newExecution.ID, "FAILED")
		return "", fmt.Errorf("publish execution job: %w", err)
	}

	return newExecution.ID.Hex(), nil
}

func (s *SchedulerService) CancelExecution(ctx context.Context, req *schedulerpb.CancelExecutionRequest) error {
	executionID, err := primitive.ObjectIDFromHex(req.ExecutionId)
	if err != nil {
		return fmt.Errorf("invalid execution id: %w", err)
	}

	execution, err := s.executionRepo.GetExecutionByID(ctx, executionID)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return fmt.Errorf("execution not found")
		}
		return err
	}

	if execution.Status != constants.StatusPending && execution.Status != constants.StatusRunning {
		return fmt.Errorf("execution status is not cancellable")
	}

	return s.producer.PublishExecutionCancel(ctx, execution.ID.Hex())
}

func (s *SchedulerService) HandleExecutionEvent(ctx context.Context, event *eventspb.ExecutionEvent) error {
	executionID, err := primitive.ObjectIDFromHex(event.ExecutionId)
	if err != nil {
		return fmt.Errorf("invalid execution id in event: %w", err)
	}

	if _, err := s.executionRepo.GetExecutionByID(ctx, executionID); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return fmt.Errorf("execution not found: %s", event.ExecutionId)
		}
		return err
	}

	now := time.Now()
	fields := bson.M{}

	switch event.EventType {
	case eventspb.ExecutionEventType_EXECUTION_STARTED:
		fields["status"] = constants.StatusRunning
		fields["startedAt"] = now
		log.Printf("execution started: executionId=%s", event.ExecutionId)

	case eventspb.ExecutionEventType_EXECUTION_COMPLETED:
		fields["status"] = constants.StatusSuccess
		fields["completedAt"] = now
		log.Printf("execution completed: executionId=%s", event.ExecutionId)

	case eventspb.ExecutionEventType_EXECUTION_FAILED:
		fields["status"] = constants.StatusFailed
		fields["completedAt"] = now
		fields["errorMessage"] = event.ErrorMessage
		log.Printf("execution failed: executionId=%s", event.ExecutionId)

	case eventspb.ExecutionEventType_EXECUTION_CANCELLED:
		fields["status"] = constants.StatusCancelled
		fields["completedAt"] = now
		log.Printf("execution cancelled: executionId=%s", event.ExecutionId)

	default:
		return nil
	}

	return s.executionRepo.UpdateExecutionFields(ctx, executionID, fields)
}
