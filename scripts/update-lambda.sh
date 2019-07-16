#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd ${DIR}/..

./scripts/build-lambda-zip.sh

FUNCTION=${FUNCTION:="ept-serve-tiles"}
REGION=${REGION:="us-east-1"}

if [ ! -f lambda.zip ]
then
    echo "Cannot find lambda.zip in `pwd`"
fi

echo "Updating lambda function"
aws lambda update-function-code \
    --function-name ${FUNCTION} \
    --region ${REGION} \
    --zip-file fileb://lambda.zip && \
echo "Done"
