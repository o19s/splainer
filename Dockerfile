FROM node:20

COPY . /home/splainer
WORKDIR /home/splainer

RUN yarn install
RUN yarn build
RUN yarn test

# Dev server for local/Docker workflows. The image
# still contains `dist/` from `yarn build`; for production serving use a
# static host (e.g. nginx) pointed at `dist/`, not this CMD.
EXPOSE 5173
CMD ["yarn", "dev", "--host", "0.0.0.0", "--port", "5173"]
