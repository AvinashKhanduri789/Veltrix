package grpc

import (
	"log"
	"net"

	"google.golang.org/grpc"

	"veltrix/logs_service/internal/services"
	logspb "veltrix/proto/logspb"
)

type Server struct {
	logspb.UnimplementedLogsServiceServer
	streamService *service.LogStreamService
}

func NewServer(svc *service.LogStreamService) *Server {
	return &Server{streamService: svc}
}

func (s *Server) StreamExecutionLogs(req *logspb.StreamLogsRequest, stream logspb.LogsService_StreamExecutionLogsServer) error {

	ch := s.streamService.Subscribe(req.ExecutionId)
	defer s.streamService.Unsubscribe(req.ExecutionId, ch)

	for {
		select {
		case logEvent, ok := <-ch:
			if !ok {
				return nil
			}

			if err := stream.Send(logEvent); err != nil {
				return err
			}
		case <-stream.Context().Done():
			return nil
		}
	}
}

func StartGRPCServer(port string, svc *service.LogStreamService) {
	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()
	logspb.RegisterLogsServiceServer(grpcServer, NewServer(svc))

	log.Printf("🚀 Logs service running on %s", port)

	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
