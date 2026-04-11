FROM node:20

COPY . /home/splainer
WORKDIR /home/splainer

RUN yarn install
RUN yarn build
RUN yarn test

# Serve the production build. For high-traffic deployments, swap to nginx.
CMD [ "yarn", "dev:vite", "--host", "0.0.0.0" ]
