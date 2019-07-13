npm run build && \
    zip lambda.zip -r dist/ -r node_modules/ && \
    aws s3 cp lambda.zip s3://na.entwine.io/ && \
    aws lambda update-function-code \
        --function-name ept-to-3dtiles \
        --s3-bucket na.entwine.io \
        --s3-key lambda.zip

