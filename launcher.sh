#!/usr/bin/env sh
export SNIP_PATH=$(dirname `readlink -f $0`)
export NODE_ENV=development
export NODE_PATH=$NODE_PATH:$SNIP_PATH:$SNIP_PATH/dependences/redis-node-client/lib:$SNIP_PATH/dependences/node-imagemagick

node "$@"

