#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd ${DIR}/..

./scripts/build-lambda-zip.sh

FUNCTION=${FUNCTION:="ept-serve-tiles"}
REGION=${REGION:="us-east-1"}
ROLE_ARN=${ROLE:=lambda_execution}

echo "Creating lambda function"
echo "  Function: ${FUNCTION}"
echo "  Region: ${REGION}"
echo "  Role: ${ROLE_ARN}"
echo "  Handler: lib/lambda.handler"

#create role
echo "PWD $DIR"
aws iam create-policy \
    --policy-name ept-tools-policy \
    --policy-document file://scripts/policy.json
policyArn=$(aws iam list-policies \
    --query 'Policies[?PolicyName==`ept-tools-policy`].Arn' \
    | jq .[0])
aws iam create-role \
    --role-name ept-tools-role \
    --assume-role-policy-document file://scripts/trust.json
roleArn=$(aws iam list-roles \
    --query 'Roles[?RoleName==`ept-tools-role`].Arn' \
    | jq .[0])

aws iam attach-role-policy \
    --role-name ept-tools-role \
    --policy-arn $policyArn


#create function and associate role with it
aws lambda create-function \
    --runtime "nodejs10.x" \
    --role ${roleArn} \
    --region ${REGION} \
    --function-name ${FUNCTION} \
    --zip-file fileb://lambda.zip \
    --handler "lib/lambda.handler" &&
echo "Done"

#construct lambda uri
temp1=$(aws lambda get-function \
    --function-name $FUNCTION \
    --query Configuration.FunctionArn)
lambdaArn=$(echo $temp1 | sed -e 's/^"//' -e 's/"$//')
lambdaUri="arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$lambdaArn/invocations"


#begin api gateway creation
aws apigateway create-rest-api \
    --name ept-tools-api-gateway \
    --binary-media-types '*/*'
gatewayId=$(aws apigateway get-rest-apis \
    --query 'items[?name==`ept-tools-api-gateway`].id' \
    | jq .[0])
rootId=$(aws apigateway get-resources \
    --rest-api-id ${gatewayId} \
    --query 'items[?path==`/`].id' \
    | jq .[0])

aws apigateway create-resource \
    --rest-api-id ${gatewayId} \
    --parent-id ${rootId} \
    --path-path '{file+}'
temp=$(aws apigateway get-resources \
    --rest-api-id ${gatewayId} \
    --query 'items[?path==`/{file+}`].id' \
    | jq .[0])
funcId=$(echo $temp | sed -e 's/^"//' -e 's/"$//')
aws apigateway put-method \
    --rest-api-id "$gatewayId" \
    --resource-id "$funcId" \
    --http-method "GET" \
    --authorization-type "NONE"

aws apigateway put-integration \
    --rest-api-id "$gatewayId" \
    --resource-id "$funcId" \
    --http-method "GET" \
    --type "AWS_PROXY" \
    --integration-http-method "GET" \
    --uri $lambdaUri