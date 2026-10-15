FROM node:20-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.mjs ./

ENV PORT=5055
EXPOSE 5055

VOLUME ["/app/.baileys_auth"]

CMD ["node", "server.mjs"]
