FROM hashicorp/terraform:1.7

RUN apk add --no-cache \
    aws-cli \
    bash \
    jq

WORKDIR /workspace

COPY . .

# Don't run as root
RUN addgroup -S terraform && \
    adduser -S terraform -G terraform && \
    chown -R terraform:terraform /workspace

USER terraform

ENTRYPOINT ["bash"] 