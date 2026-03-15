package domain

import (
    "time"
    "go.mongodb.org/mongo-driver/bson/primitive"
)

type FunctionVersion struct {
    ID               primitive.ObjectID `bson:"_id,omitempty"`
    FunctionId       primitive.ObjectID `bson:"functionId"`
    UserId           primitive.ObjectID `bson:"userId"`
    VersionNumber    int                `bson:"versionNumber"`
    CodeStoragePath  string             `bson:"codeStoragePath"`
    RuntimeVersion   string             `bson:"runtimeVersion"`
    ContainerImageTag string            `bson:"containerImageTag"`
    CodeHash         string             `bson:"codeHash"`
    CreatedAt        time.Time          `bson:"createdAt"`
}
