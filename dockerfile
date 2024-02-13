FROM oven/bun:alpine

WORKDIR /

RUN apk add --no-cache vips

COPY package.json bun.lockb *.ts ./

RUN bun install --production

CMD ["bun", "index.ts"]
