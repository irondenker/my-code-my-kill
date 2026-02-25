FROM alpine:3.21

RUN apk add --no-cache nginx nginx-mod-http-headers-more

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
