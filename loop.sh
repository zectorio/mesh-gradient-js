#!/bin/bash

while [ 1 ]
do
  npm run exitonchange polyfill.js
  npm run addpolyfill
done
