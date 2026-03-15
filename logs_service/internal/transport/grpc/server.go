package grpc

import (
	"log"
	"net"
	pb "veltrix/proto/logspb"
	"google.golang.org/grpc"
)

type GrpcServer struct{
	port int
}

func NewGrpcServer(port int)(*GrpcServer){
	return &GrpcServer{
		port: port,
	}
}


func (s *GrpcServer) Start() {

	lis, err := net.Listen("tcp", ":50052")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()

	handler := NewLogsHandler()

	pb.RegisterLogsServiceServer(grpcServer, handler)

	log.Println("Log gRPC server running on port 50052")

	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}