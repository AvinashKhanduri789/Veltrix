package domain

import (
    "time"

    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"
)

type Execution struct {
    ID                primitive.ObjectID `bson:"_id,omitempty"`
    UserId            primitive.ObjectID `bson:"userId"`
    FunctionId        primitive.ObjectID `bson:"functionId"`
    FunctionVersionId primitive.ObjectID `bson:"functionVersionId"`
    TriggerType       string             `bson:"triggerType"`
    ReplayOf          *primitive.ObjectID `bson:"replayOf,omitempty"`
    Status            string             `bson:"status"`
    InputPayload      bson.M             `bson:"inputPayload"`
    RuntimeVersion    string             `bson:"runtimeVersion"`
    ContainerImageTag string             `bson:"containerImageTag"`
    TimeoutMs         int                `bson:"timeoutMs"`
    MemoryLimitMb     int                `bson:"memoryLimitMb"`
    ExitCode          *int               `bson:"exitCode,omitempty"`
    ErrorMessage      *string            `bson:"errorMessage,omitempty"`
    StartedAt         *time.Time         `bson:"startedAt,omitempty"`
    CompletedAt       *time.Time         `bson:"completedAt,omitempty"`
    CreatedAt         time.Time          `bson:"createdAt"`
}