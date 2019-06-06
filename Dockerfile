FROM node:8
MAINTAINER  Eric Pugh "epugh@opensourceconnections.com"

COPY . /home/splainer
WORKDIR /home/splainer

# Must have packages
RUN printf "deb http://archive.debian.org/debian/ jessie main\ndeb-src http://archive.debian.org/debian/ jessie main\ndeb http://security.debian.org jessie/updates main\ndeb-src http://security.debian.org jessie/updates main" > /etc/apt/sources.list
RUN apt-get update -qq && apt-get install -y vim curl git tmux build-essential libpng-dev
RUN curl --compressed -o- -L https://yarnpkg.com/install.sh | bash

# Install Chrome Headless
RUN apt-get update                              \
  && apt-get install -y --no-install-recommends \
    ca-certificates                             \
    bzip2                                       \
    libfontconfig                               \
    gconf-service                               \
    libasound2                                  \
    libatk1.0-0                                 \
    libatk1.0-0                                 \
    libdbus-1-3                                 \
    libgconf-2-4                                \
    libgtk-3-0                                  \
    libnspr4                                    \
    libnss3                                     \
    libx11-xcb1                                 \
    libxss1                                     \
    libxtst6                                    \
    fonts-liberation                            \
    libappindicator1                            \
    libappindicator3-1                          \
    xdg-utils                                   \
    lsb-release                                 \
    wget                                        \
    curl                                        \
    xz-utils -y --no-install-recommends &&      \
  wget https://dl.google.com/linux/direct/google-chrome-unstable_current_amd64.deb && \
  dpkg -i google-chrome*.deb &&                 \
  apt-get install -f &&                         \
  apt-get clean autoclean &&                    \
  rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* google-chrome-unstable_current_amd64.deb

RUN npm install -g grunt-cli          && \
  yarn global add phantomjs-prebuilt  && \
  npm install -g bower                && \
  bower install --allow-root          && \
  yarn

CMD [ "grunt", "serve" ]
