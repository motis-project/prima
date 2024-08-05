FROM node:20

COPY build /build
COPY migrations /build/migrations
COPY package.json /
COPY node_modules /node_modules

CMD ["node", "/build"]