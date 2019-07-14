npm run build && \
    zip lambda.zip -r dist/ -r node_modules/ && \
    aws s3 cp lambda.zip s3://west.entwine.io/ && \
    aws lambda update-function-code \
        --function-name ept-to-3dtiles-west \
        --s3-bucket west.entwine.io \
        --s3-key lambda.zip \
        --region us-west-2

