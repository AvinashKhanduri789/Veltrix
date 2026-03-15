package grpc

import (
	"time"
	pb "veltrix/proto/logspb"
)

type LogsHandler struct {
	pb.UnimplementedLogsServiceServer
}

func NewLogsHandler() *LogsHandler {
	return &LogsHandler{}
}

func (h *LogsHandler) StreamExecutionLogs(
	req *pb.StreamLogsRequest,
	stream pb.LogsService_StreamExecutionLogsServer,
) error {

	executionID := req.GetExecutionId()

	logs := []string{
		"Starting execution...",
		"Downloading function code...",
		"Initializing runtime...",
		"Running user code...",
		"Execution completed successfully.",
	}

	for _, msg := range logs {

		select {

		case <-stream.Context().Done():
			return stream.Context().Err()

		default:

			event := &pb.LogEvent{
				ExecutionId: executionID,
				Timestamp:   time.Now().Format(time.RFC3339),
				Stream:      "stdout",
				Message:     msg,
			}

			if err := stream.Send(event); err != nil {
				return err
			}

			time.Sleep(1 * time.Second)
		}
	}

	return nil
}