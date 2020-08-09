FROM amazonlinux:2.0.20200722.0
MAINTAINER yoodonghoon01@gmail.com

ENV token=
ENV spaceid=
ENV maxqty=30
ENV maxsize=10

RUN curl -sL https://rpm.nodesource.com/setup_lts.x | bash - && \
    yum install -y nodejs

COPY ./src /notionkeeper

WORKDIR /notionkeeper

RUN npm install

ENTRYPOINT node . \
    ${token} \
    ${spaceid} \
    ${maxqty} \
    ${maxsize}