#!/bin/sh

# Die on error
set -e

cd $(dirname $0)


# Fetch some prerequisites: SVG optimizer and JS minifier
npm install svgo uglifyjs

# Fetch a patached version of pyswf
git clone -b all-patches https://github.com/tuomassalo/pyswf.git


curl https://shop.vr.fi/onlineshop/pages/static/flash/coachmap.swf > coachmap.swf

mkdir -p dist/coaches
PYTHONPATH=./pyswf python parse-coachmap.py

node_modules/uglifyjs/bin/uglifyjs -m < nf.js > dist/nf.min.js


