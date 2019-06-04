FROM node:4
MAINTAINER  Eric Pugh "epugh@opensourceconnections.com"

COPY . /home/splainer
WORKDIR /home/splainer

# Must have packages
RUN apt-get update -qq && apt-get install -y vim curl git tmux build-essential libpng-dev

# Install PhantomJS
RUN apt-get update                              \
  && apt-get install -y --no-install-recommends \
    ca-certificates                             \
    bzip2                                       \
    libfontconfig                               \
  && apt-get clean                              \
  && rm -rf /var/lib/apt/lists/*

RUN apt-get update                                      \
  && apt-get install -y --no-install-recommends         \
    curl                                                \
  && mkdir /tmp/phantomjs                               \
  && curl -L                                            \
    https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-2.1.1-linux-x86_64.tar.bz2  \
    | tar -xj --strip-components=1 -C /tmp/phantomjs    \
  && cd /tmp/phantomjs                                  \
  && mv bin/phantomjs /usr/local/bin                    \
  && cd                                                 \
  && apt-get clean                                      \
  && rm -rf /tmp/* /var/lib/apt/lists/*

RUN npm install -g grunt-cli          && \
  yarn global add phantomjs-prebuilt  && \
  npm install -g bower                && \
  bower install --allow-root          && \
  yarn

CMD [ "grunt", "serve" ]
