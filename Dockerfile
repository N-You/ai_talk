# AI English Tutor - uniapp H5 前端镜像（多阶段构建）
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && npm install --legacy-peer-deps

COPY . .
# 构建 H5 产物（输出到 dist/build/h5）
RUN npm run build:h5

# 运行阶段：nginx 托管静态资源
FROM nginx:alpine

COPY --from=build /app/dist/build/h5 /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
