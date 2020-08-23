FROM node:lts-alpine3.12
MAINTAINER yoodonghoon01@gmail.com

ENV token=
ENV spaceid=

ENV maxqty=30
ENV maxsize=10

ENV cron=

ENV webdav_url=
ENV webdav_path=
ENV webdav_user=
ENV webdav_pass=

COPY ./src /notionkeeper

WORKDIR /notionkeeper

RUN npm install

ENTRYPOINT node .