FROM node:14
MAINTAINER  Eric Pugh "epugh@opensourceconnections.com"

COPY . /home/splainer
WORKDIR /home/splainer

# prevent arm64 builds from failing by setting the env variables and installing chromium directly 
ENV DEBIAN_FRONTEND noninteractive
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Dependencies for Puppeteer/Chromium
RUN apt-get update -qq \
  && apt-get install -y --no-install-recommends gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils libgbm1 wget graphviz \
  && apt-get install -y chromium \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g grunt-cli
RUN yarn install
RUN grunt test

CMD [ "grunt", "serve" ]
