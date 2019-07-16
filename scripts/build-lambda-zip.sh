#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd ${DIR}/..

VERSION="0.0.0"
TMP=`mktemp -d 2>/dev/null || mktemp -d -t 'etl'`

echo "Creating lambda .zip package"
echo "  Zip: lambda.zip"
echo "  Handler: lib/lambda.handler"

npm pack --silent &&
    mv ept-tools-${VERSION}.tgz ${TMP} && \
    (
        cd ${TMP} && \
        mkdir ept-tools && \
        tar -xf ept-tools-${VERSION}.tgz && \
        (
            cd package/ && npm install --production --silent && \
            zip ../lambda.zip -r ./* -q
        )
    ) &&
    mv ${TMP}/lambda.zip . &&
    echo "Done"
