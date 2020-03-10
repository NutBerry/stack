FROM node:lts-alpine AS base
FROM base AS deps
# ARG BUILD_DEPS="git g++ cmake make python2"
# Only git is required.
# We will use pure js functions without native modules,
# thus we do not need to compile anything.
ARG BUILD_DEPS="git"
RUN apk add --no-cache $BUILD_DEPS
COPY package.json yarn.lock /opt/
RUN yarn install --production --frozen-lockfile --ignore-optional --verbose

FROM base AS release
WORKDIR /opt/node
COPY . /opt/node
COPY --from=deps /opt/node_modules /opt/node_modules
CMD ["/opt/node/nutberry-node.js"]
