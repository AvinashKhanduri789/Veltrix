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
	addr := fmt.Sprintf("0.0.0.0:%d", s.port)

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("failed to listen on %s: %v", addr, err)
	}

	grpcServer := grpc.NewServer()

	pb.RegisterSchedulerServiceServer(grpcServer, s.handler)

	log.Printf("Scheduler gRPC server running on %s", addr)

	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}