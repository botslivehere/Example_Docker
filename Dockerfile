FROM postgres:latest

ADD ./init.sql /docker-entrypoint-initdb.d

FROM node:latest

# Установка зависимостей
WORKDIR /project
COPY package*.json ./
RUN npm install

# Копирование исходного кода
COPY . .

# Запуск приложения
CMD ["node", "index.js"]
