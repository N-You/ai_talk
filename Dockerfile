# AI English Tutor - Vue3 + Vite H5 前端镜像（多阶段构建）
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && npm install --legacy-peer-deps

COPY . .
# 构建 H5 产物（vue-tsc 类型检查 + vite build，输出到 dist/）
RUN npm run build

# 运行阶段：nginx 托管静态资源
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
