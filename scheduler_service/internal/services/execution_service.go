package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	eventspb "veltrix/proto/eventspb"
	schedulerpb "veltrix/proto/schedulerpb"
	"veltrix/scheduler_service/internal/domain"
	"veltrix/scheduler_service/internal/kafka"
	"veltrix/scheduler_service/internal/repository"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ExecutionService struct {
	repo     *repository.ExecutionRepository
	producer *kafka.Producer
}

func NewExecutionService(repo *repository.ExecutionRepository, producer *kafka.Producer) *ExecutionService {
	return &ExecutionService{repo: repo, producer: producer}
}

func (s *ExecutionService) CreateExecution(ctx context.Context, req *schedulerpb.TriggerExecutionRequest) (string, error) {
	userID, err := primitive.ObjectIDFromHex(req.UserId)
	if err != nil {
		return "", fmt.Errorf("invalid user id: %w", err)
	}

	functionID, err := primitive.ObjectIDFromHex(req.FunctionId)
	if err != nil {
		return "", fmt.Errorf("invalid function id: %w", err)
	}

	versionID, err := primitive.ObjectIDFromHex(req.VersionId)
	if err != nil {
		return "", fmt.Errorf("invalid version id: %w", err)
	}

	if req.CodeStoragePath == "" {
		return "", fmt.Errorf("invalid code storage path")
	}

	if req.Runtime == "" {
		return "", fmt.Errorf("invalid runtime")
	}

	if req.TimeoutSeconds <= 0 {
		return "", fmt.Errorf("invalid timeout")
	}
	payload := bson.M{}
	if req.InputPayload != "" {
		if err := json.Unmarshal([]byte(req.InputPayload), &payload); err != nil {
			return "", fmt.Errorf("invalid input payload: %w", err)
		}
	}

	execution := &domain.Execution{
		ID:                primitive.NewObjectID(),
		UserId:            userID,
		FunctionId:        functionID,
		FunctionVersionId: versionID,
		TriggerType:       "MANUAL",
		Status:            "PENDING",
		InputPayload:      payload,
		RuntimeVersion:    req.Runtime,
		ContainerImageTag: "",
		TimeoutMs:         int(req.TimeoutSeconds) * 1000,
		MemoryLimitMb:     256,
		CreatedAt:         time.Now(),
	}

	if err := s.repo.CreateExecution(ctx, execution); err != nil {
		return "", fmt.Errorf("create execution: %w", err)
	}

	job := &eventspb.ExecutionJob{
		ExecutionId:     execution.ID.Hex(),
		UserId:          req.UserId,
		FunctionId:      req.FunctionId,
		VersionId:       req.VersionId,
		CodeStoragePath: req.CodeStoragePath,
		Runtime:         req.Runtime,
		InputPayload:    req.InputPayload,
		TimeoutSeconds:  req.TimeoutSeconds,
	}

	if err := s.producer.PublishExecutionJob(ctx, job); err != nil {
		_ = s.repo.UpdateExecutionStatus(ctx,execution.ID,"FAILED")
		return "", fmt.Errorf("publish execution job: %w", err)
	}

	return execution.ID.Hex(), nil
}
