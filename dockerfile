FROM oven/bun:alpine

WORKDIR /

RUN apk add --no-cache vips

COPY package.json bun.lockb index.ts optimize.ts ./

RUN bun install --production

CMD ["bun", "index.ts"]
