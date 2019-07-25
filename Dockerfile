FROM node:8
MAINTAINER  Eric Pugh "epugh@opensourceconnections.com"

COPY . /home/splainer
WORKDIR /home/splainer


RUN npm install -g grunt-cli
RUN npm install

CMD [ "npm", "run", "serve" ]
