FROM node:20-alpine
WORKDIR /app
COPY worker/package.json .
RUN npm install
COPY worker/ .
COPY src/lib/db/ ./src/lib/db/
CMD ["npm", "start"]
