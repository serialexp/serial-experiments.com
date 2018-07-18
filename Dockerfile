FROM richarvey/nginx-php-fpm:latest

MAINTAINER Bart Riepe <bart@serial-experiments.com>

ENV WEBROOT="/var/www/html"

COPY ./ /var/www/html/