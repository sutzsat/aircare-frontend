FROM nginx:1.27-alpine

ARG API_UPSTREAM=http://host.docker.internal:8000

COPY . /usr/share/nginx/html
RUN printf 'server {\n  listen 80;\n  server_name _;\n  root /usr/share/nginx/html;\n  index index.html;\n  location /api/ {\n    proxy_pass __API_UPSTREAM__;\n    proxy_http_version 1.1;\n    proxy_set_header Host $host;\n    proxy_set_header X-Real-IP $remote_addr;\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    proxy_set_header X-Forwarded-Proto $scheme;\n  }\n  location / { try_files $uri $uri/ /index.html; }\n}\n' | sed "s|__API_UPSTREAM__|${API_UPSTREAM}|g" > /etc/nginx/conf.d/default.conf

EXPOSE 80
