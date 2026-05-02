package runtime

import (
	"veltrix/proto/runtimepb"
	"fmt"
)

type RuntimeRouter struct {
	clients map[string]runtimepb.RuntimeExecutionServiceClient
}

func NewRuntimeRouter(clients map[string]runtimepb.RuntimeExecutionServiceClient) *RuntimeRouter {
	return &RuntimeRouter{
		clients: clients,
	}
}


func (r *RuntimeRouter) GetClient(runtime string) (runtimepb.RuntimeExecutionServiceClient, error) {
	client, ok := r.clients[runtime]
	if !ok {
		return nil, fmt.Errorf("unsupported runtime: %s", runtime)
	}
	return client, nil
}