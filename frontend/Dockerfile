FROM nginx:alpine

# Copy the static HTML file
COPY index.html /usr/share/nginx/html/index.html

# Copy custom nginx config so we can inject env vars
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
