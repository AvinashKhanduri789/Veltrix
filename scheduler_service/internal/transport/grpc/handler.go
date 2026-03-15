package grpc

import (
	"context"
	"strings"

	pb "veltrix/proto/schedulerpb"
	"veltrix/scheduler_service/internal/services"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type SchedulerHandler struct {
	pb.UnimplementedSchedulerServiceServer
	schedulerService *services.SchedulerService
}

func NewSchedulerHandler(schedulerService *services.SchedulerService) *SchedulerHandler {
	return &SchedulerHandler{schedulerService: schedulerService}
}

func (h *SchedulerHandler) TriggerExecution(ctx context.Context, req *pb.TriggerExecutionRequest) (*pb.TriggerExecutionResponse, error) {
	executionID, err := h.schedulerService.TriggerExecution(ctx, req)
	if err != nil {
		if strings.HasPrefix(err.Error(), "invalid ") {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &pb.TriggerExecutionResponse{
		ExecutionId: executionID,
		Status:      "QUEUED",
	}, nil
}

func (h *SchedulerHandler) CancelExecution(ctx context.Context, req *pb.CancelExecutionRequest) (*pb.CancelExecutionResponse, error) {
	err := h.schedulerService.CancelExecution(ctx, req)
	if err != nil {
		switch {
		case strings.HasPrefix(err.Error(), "invalid "):
			return nil, status.Error(codes.InvalidArgument, err.Error())
		case strings.Contains(err.Error(), "not found"):
			return nil, status.Error(codes.NotFound, err.Error())
		case strings.Contains(err.Error(), "not cancellable"):
			return nil, status.Error(codes.FailedPrecondition, err.Error())
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	return &pb.CancelExecutionResponse{
		Accepted: true,
		Message:  "Cancel request accepted",
	}, nil
}

func (h *SchedulerHandler) ReplayExecution(ctx context.Context, req *pb.ReplayExecutionRequest) (*pb.ReplayExecutionResponse, error) {
	newExecutionID, err := h.schedulerService.ReplayExecution(ctx, req)
	if err != nil {
		switch {
		case strings.HasPrefix(err.Error(), "invalid "):
			return nil, status.Error(codes.InvalidArgument, err.Error())
		case strings.Contains(err.Error(), "not found"):
			return nil, status.Error(codes.NotFound, err.Error())
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	return &pb.ReplayExecutionResponse{
		NewExecutionId: newExecutionID,
		Status:         "QUEUED",
	}, nil
}
