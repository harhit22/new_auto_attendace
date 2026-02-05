# Build Stage
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Run Stage (Output files to volume)
FROM alpine:3.18
WORKDIR /app
COPY --from=build /app/build ./build
# Copy build files to the mounted volume and keep container running
CMD ["sh", "-c", "cp -r /app/build/* /frontend_static/ && tail -f /dev/null"]
