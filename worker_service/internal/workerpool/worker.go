package workerpool


import (
	"context"
	"log"

	eventspb "veltrix/proto/eventspb"
)

// Worker represents a single worker goroutine
type Worker struct {
	id      int
	handler WorkerFunc
}

// NewWorker creates a new worker
func NewWorker(id int, handler WorkerFunc) *Worker {
	return &Worker{
		id:      id,
		handler: handler,
	}
}

// Start begins worker loop
func (w *Worker) Start(ctx context.Context, jobQueue <-chan *eventspb.ExecutionJob) {
	log.Printf("worker %d started", w.id)

	for {
		select {

		case <-ctx.Done():
			log.Printf("worker %d shutting down", w.id)
			return

		case job, ok := <-jobQueue:
			if !ok {
				log.Printf("worker %d job queue closed", w.id)
				return
			}

			w.processJob(ctx, job)
		}
	}
}

// processJob handles a single execution job
func (w *Worker) processJob(ctx context.Context, job *eventspb.ExecutionJob) {

	log.Printf("worker %d picked job: %s", w.id, job.ExecutionId)

	// Panic safety (VERY IMPORTANT)
	defer func() {
		if r := recover(); r != nil {
			log.Printf("worker %d panic: executionId=%s err=%v", w.id, job.ExecutionId, r)
		}
	}()

	// Call injected handler (execution logic)
	w.handler(ctx, job)

	// Later this will:
	// 1. fetch code (redis/minio)
	// 2. route runtime
	// 3. open gRPC stream
	// 4. stream logs
	// 5. publish logs/events
}