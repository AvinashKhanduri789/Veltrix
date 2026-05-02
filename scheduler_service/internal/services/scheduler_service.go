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

	if req.ExecutionId == "" {
		return "", fmt.Errorf("Invalid ExecutionId")
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

	log.Printf("📩 EVENT RECEIVED executionId=%s type=%v error=%s",
		event.ExecutionId,
		event.EventType,
		event.ErrorMessage,
	)

	executionID, err := primitive.ObjectIDFromHex(event.ExecutionId)
	if err != nil {
		log.Printf("invalid execution id: %s", event.ExecutionId)
		return fmt.Errorf("invalid execution id: %w", err)
	}

	now := time.Now()

	update := bson.M{}
	filter := bson.M{
		"_id": executionID,
	}

	switch event.EventType {

	case eventspb.ExecutionEventType_EXECUTION_STARTED:
		log.Printf("processing STARTED event executionId=%s", event.ExecutionId)
		filter["status"] = bson.M{
			"$in": []string{
				constants.StatusPending,
				constants.StatusFailed,
			},
		}

		update["status"] = constants.StatusRunning
		update["startedAt"] = now

	case eventspb.ExecutionEventType_EXECUTION_COMPLETED:

		filter["status"] = constants.StatusRunning

		update["status"] = constants.StatusSuccess
		update["completedAt"] = now

		if event.Output != "" {
			update["output"] = event.Output
		}

	case eventspb.ExecutionEventType_EXECUTION_FAILED:
		log.Printf("processing FAILED event executionId=%s", event.ExecutionId)

		filter["status"] = bson.M{
			"$in": []string{
				constants.StatusPending,
				constants.StatusRunning,
			},
		}
		update["status"] = constants.StatusFailed
		update["completedAt"] = now
		update["errorMessage"] = event.ErrorMessage

	case eventspb.ExecutionEventType_EXECUTION_CANCELLED:
		log.Printf("processing CANCELLED event executionId=%s", event.ExecutionId)

		filter["status"] = bson.M{
			"$in": []string{
				constants.StatusPending,
				constants.StatusRunning,
			},
		}
		update["status"] = constants.StatusCancelled
		update["completedAt"] = now

	default:
		log.Printf(" unknown event type executionId=%s type=%v",
			event.ExecutionId, event.EventType)
		return nil
	}

	log.Printf("applying update executionId=%s filter=%v update=%v",
		event.ExecutionId, filter, update,
	)

	res, err := s.executionRepo.UpdateExecutionWithFilter(ctx, filter, update)
	if err != nil {
		log.Printf("update failed executionId=%s err=%v",
			event.ExecutionId, err)
		return fmt.Errorf("failed to update execution %s: %w", event.ExecutionId, err)
	}

	if res.MatchedCount == 0 {
		log.Printf(
			" STATE MISMATCH executionId=%s event=%v filter=%v",
			event.ExecutionId,
			event.EventType,
			filter,
		)
		return nil
	}

	log.Printf(
		"execution updated executionId=%s event=%v",
		event.ExecutionId,
		event.EventType,
	)

	return nil
}
