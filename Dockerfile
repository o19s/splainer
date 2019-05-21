FROM node:4
MAINTAINER  Eric Pugh "epugh@opensourceconnections.com"

COPY . /home/splainer
WORKDIR /home/splainer

RUN npm install -g grunt-cli && \
    npm install -g bower && \
    npm install && \
    bower install --allow-root

CMD ["grunt","serve"]
