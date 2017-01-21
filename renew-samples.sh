#!/bin/bash

for fname in `ls docs/samples | grep -v with-polyfill`
do
  npm run addpolyfill docs/samples/$fname
  rname="${fname%.*}"
  mv out.svg docs/samples/${rname}-with-polyfill.svg
done