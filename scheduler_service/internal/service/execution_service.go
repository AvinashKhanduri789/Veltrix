package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	eventspb "veltrix/proto/eventspb"
	schedulerpb "veltrix/proto/schedulerpb"
	"veltrix/scheduler_service/internal/domain"
	"veltrix/scheduler_service/internal/kafka"
	"veltrix/scheduler_service/internal/repository"
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
		ExecutionId:    execution.ID.Hex(),
		UserId:         req.UserId,
		FunctionId:     req.FunctionId,
		VersionId:      req.VersionId,
		CodeStoragePath: req.CodeStoragePath,
		Runtime:        req.Runtime,
		InputPayload:   req.InputPayload,
		TimeoutSeconds: req.TimeoutSeconds,
	}

	if err := s.producer.PublishExecutionJob(ctx, job); err != nil {
		return "", fmt.Errorf("publish execution job: %w", err)
	}

	return execution.ID.Hex(), nil
}
