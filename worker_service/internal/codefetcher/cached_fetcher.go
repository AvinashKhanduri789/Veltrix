package codefetcher

import (
	"context"
	"log"
	"time"
	"veltrix/worker_service/internal/domain"
	"github.com/redis/go-redis/v9"
)

type CacheCodeFetcher struct {
	cacheStore domain.CacheStore
	miniIoFetcher domain.Storage
}



func NewCacheCodeFetcher(redisFetcher domain.CacheStore,miniIoFetcher domain.Storage)(*CacheCodeFetcher){
	return &CacheCodeFetcher{
		cacheStore: redisFetcher,
		miniIoFetcher: miniIoFetcher,
	}
}


func (c *CacheCodeFetcher) Fetch(ctx context.Context, codePath string) ([]byte, error) {

	
	code, err := c.cacheStore.Get(ctx, codePath)
	if err == nil {
		return code, nil 
	}

	
	if err != redis.Nil {
		log.Printf("redis GET failed | key=%s err=%v", codePath, err)
	}

	
	code, err = c.miniIoFetcher.GetCode(ctx, codePath)
	if err != nil {
		log.Printf("minio fetch failed | key=%s err=%v", codePath, err)
		return nil, err
	}


	if err := c.cacheStore.Set(ctx, codePath, code, 10*time.Minute); err != nil {
		log.Printf("cache SET failed (non-blocking) | key=%s err=%v", codePath, err)
	}

	return code, nil
}