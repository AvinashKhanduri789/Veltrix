package grpc

import (
	"fmt"
	"log"
	"net"
	pb "veltrix/proto/schedulerpb"

	"google.golang.org/grpc"
)

type GrpcServer struct {
	port    int
	handler pb.SchedulerServiceServer
}

func NewGrpcServer(port int, handler pb.SchedulerServiceServer) *GrpcServer {
	return &GrpcServer{
		port:    port,
		handler: handler,
	}
}

func (s *GrpcServer) Start() {
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", s.port))
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()

	pb.RegisterSchedulerServiceServer(grpcServer, s.handler)

	log.Printf("Scheduler gRPC server running on port %d", s.port)

	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
