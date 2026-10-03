ARG PHP_VERSION=8.5

FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM php:${PHP_VERSION}-apache

RUN docker-php-ext-install pdo pdo_mysql \
    && a2enmod rewrite \
    && sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

COPY . /var/www/html/
COPY --from=frontend /app/frontend/dist/ /var/www/html/frontend/dist/

RUN mkdir -p /var/www/html/public/assets \
    && cp -a /var/www/html/frontend/dist/assets/. /var/www/html/public/assets/ \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public

RUN sed -i 's|DocumentRoot /var/www/html|DocumentRoot ${APACHE_DOCUMENT_ROOT}|g' /etc/apache2/sites-available/000-default.conf \
    && sed -i 's|<Directory /var/www/html>|<Directory ${APACHE_DOCUMENT_ROOT}>|g' /etc/apache2/apache2.conf

EXPOSE 80