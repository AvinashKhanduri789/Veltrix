package service

import (
	"log"
	"sync"

	logspb "veltrix/proto/logspb"
)

// LogStreamService handles in-memory fan-out of log events per executionId
// This is ONLY responsible for multiplexing gRPC streams (no buffering/replay logic)
type LogStreamService struct {
	subscribers map[string][]chan *logspb.LogEvent
	mu          sync.RWMutex
}

func NewLogStreamService() *LogStreamService {
	return &LogStreamService{
		subscribers: make(map[string][]chan *logspb.LogEvent),
	}
}

// Subscribe registers a new subscriber for an executionId
func (s *LogStreamService) Subscribe(executionID string) chan *logspb.LogEvent {
	ch := make(chan *logspb.LogEvent, 100)

	s.mu.Lock()
	s.subscribers[executionID] = append(s.subscribers[executionID], ch)
	count := len(s.subscribers[executionID])
	s.mu.Unlock()

	log.Printf("👂 subscriber added executionId=%s total=%d", executionID, count)

	return ch
}

// Unsubscribe removes a subscriber and closes its channel
func (s *LogStreamService) Unsubscribe(executionID string, target chan *logspb.LogEvent) {
	s.mu.Lock()
	defer s.mu.Unlock()

	subs := s.subscribers[executionID]
	newSubs := make([]chan *logspb.LogEvent, 0, len(subs))

	for _, ch := range subs {
		if ch != target {
			newSubs = append(newSubs, ch)
		} else {
			close(ch)
		}
	}

	if len(newSubs) == 0 {
		delete(s.subscribers, executionID)
	} else {
		s.subscribers[executionID] = newSubs
	}

	log.Printf("🧹 subscriber removed executionId=%s remaining=%d", executionID, len(newSubs))
}

// Publish sends log event to all subscribers (non-blocking)
func (s *LogStreamService) Publish(event *logspb.LogEvent) {
	s.mu.RLock()
	subs := s.subscribers[event.ExecutionId]
	s.mu.RUnlock()

	if len(subs) == 0 {
		// no subscribers → expected behavior in live-stream model
		log.Printf("⚠️ no subscribers executionId=%s msg=%s", event.ExecutionId, event.Message)
		return
	}

	for i, ch := range subs {
		select {
		case ch <- event:
			log.Printf("➡️ delivered executionId=%s subscriber=%d", event.ExecutionId, i)
		default:
			log.Printf("❌ dropped (slow consumer) executionId=%s subscriber=%d", event.ExecutionId, i)
		}
	}
}
