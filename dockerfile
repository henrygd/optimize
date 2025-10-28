FROM oven/bun:alpine AS builder

WORKDIR /

ENV NODE_ENV=production

COPY package.json bun.lockb *.ts ./

RUN apk add --no-cache vips

RUN bun install --libc=musl --production --no-cache

RUN bun build \
  --compile \
  --minify-whitespace \
  --minify-syntax \
  --target bun \
  --outfile /optimize \
  ./index.ts

# ? -------------------------

FROM alpine:latest

RUN apk add --no-cache vips

COPY --from=builder /optimize /optimize

COPY --from=builder /node_modules/@img /node_modules/@img
RUN sh -c 'for path in /node_modules/@img/*; do case "$path" in *musl*) ;; *) rm -rf "$path" ;; esac; done'

CMD ["/optimize"]
