#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd ${DIR}/..

./scripts/build-lambda-zip.sh

FUNCTION=${FUNCTION:="ept-serve-tiles"}
REGION=${REGION:="us-east-1"}
ROLE_ARN=${ROLE:=lambda_execution}
MEMORY=${MEMORY:=1024}

echo "Creating lambda function"
echo "  Function: ${FUNCTION}"
echo "  Region: ${REGION}"
echo "  Role: ${ROLE_ARN}"
echo "  Memory: ${MEMORY}"
echo "  Handler: lib/lambda.handler"

#create role
aws iam create-policy \
    --policy-name ept-tools-policy \
    --policy-document file://scripts/policy.json
policyArn=$(aws iam list-policies \
    --query 'Policies[?PolicyName==`ept-tools-policy`].Arn' \
    | jq .[0])
policyArn=$(echo $policyArn | sed -e 's/^"//' -e 's/"$//')
aws iam create-role \
    --role-name ept-tools-role \
    --assume-role-policy-document file://scripts/trust.json
roleArn=$(aws iam list-roles \
    --query 'Roles[?RoleName==`ept-tools-role`].Arn' \
    | jq .[0])
roleArn=$(echo $roleArn | sed -e 's/^"//' -e 's/"$//')

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
    --memory-size ${MEMORY} \
    --environment Variables={ROOT='https://s3-us-west-2.amazonaws.com/usgs-lidar-public'} \
    --handler "lib/lambda.handler" &&
echo "Done"

#construct lambda uri
lambdaArn=$(aws lambda get-function \
    --region ${REGION} \
    --function-name $FUNCTION \
    --query Configuration.FunctionArn)
lambdaArn=$(echo $lambdaArn | sed -e 's/^"//' -e 's/"$//')
lambdaUri="arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$lambdaArn/invocations"


#begin api gateway creation
gatewayId=$(aws apigateway get-rest-apis \
    --region ${REGION} \
    --query 'items[?name==`ept-tools-api-gateway`].id' \
    | jq .[0])
if [ $gatewayId == 'null' ]
then
    echo "made it here"
    aws apigateway create-rest-api \
        --region ${REGION} \
        --name ept-tools-api-gateway \
        --binary-media-types '*/*'
    gatewayId=$(aws apigateway get-rest-apis \
        --region ${REGION} \
        --query 'items[?name==`ept-tools-api-gateway`].id' \
        | jq .[0])
fi
gatewayId=$(echo $gatewayId | sed -e 's/^"//' -e 's/"$//')
echo "GatewayId: $gatewayId"
rootId=$(aws apigateway get-resources \
    --region ${REGION} \
    --rest-api-id ${gatewayId} \
    --query 'items[?path==`/`].id' \
    | jq .[0])
rootId=$(echo $rootId | sed -e 's/^"//' -e 's/"$//')
echo "RootId: $rootId"

aws apigateway create-resource \
    --region ${REGION} \
    --rest-api-id ${gatewayId} \
    --parent-id ${rootId} \
    --path-part '{file+}'
funcId=$(aws apigateway get-resources \
    --region ${REGION} \
    --rest-api-id ${gatewayId} \
    --query 'items[?path==`/{file+}`].id' \
    | jq .[0])
funcId=$(echo $funcId | sed -e 's/^"//' -e 's/"$//')
echo "LambdaId: ${funcId}"
aws apigateway put-method \
    --region ${REGION} \
    --rest-api-id "$gatewayId" \
    --resource-id "$funcId" \
    --http-method "GET" \
    --authorization-type "NONE"

aws apigateway put-integration \
    --region ${REGION} \
    --rest-api-id "$gatewayId" \
    --resource-id "$funcId" \
    --http-method "GET" \
    --type "AWS_PROXY" \
    --integration-http-method "POST" \
    --uri ${lambdaUri}

aws lambda add-permission \
    --region ${REGION} \
    --function-name ${FUNCTION} \
    --principal 'apigateway.amazonaws.com' \
    --action 'lambda:InvokeFunction' \
    --statement-id 'AllowExecutionFromApiGateway'

##Create deployment
aws apigateway create-deployment \
    --region ${REGION} \
    --rest-api-id ${gatewayId} \
    --stage-name 'prod'


