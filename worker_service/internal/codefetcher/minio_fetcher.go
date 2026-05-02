package codefetcher

import (
	"bytes"
	"context"
	"io"

	"github.com/minio/minio-go/v7"
)


type MinIOFetcher struct{
	client *minio.Client
	bucket string
}


func NewMinIOFetcher(client *minio.Client,bucket string) (*MinIOFetcher){
	return &MinIOFetcher{
		client: client,
		bucket: bucket,
	}
}

func (m *MinIOFetcher) GetCode(ctx context.Context, codePath string) ([]byte, error){
	obj, err:= m.client.GetObject(ctx,m.bucket,codePath,minio.GetObjectOptions{})
	if err!=nil{
		return nil,err
	}
	defer obj.Close()
	var buffer bytes.Buffer
	_,err = io.Copy(&buffer, obj)
	if err!=nil{
		return nil, err
	}
	return buffer.Bytes(),nil
}	