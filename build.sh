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

# Populate the list of known coach types
COACH_TYPES=$(ls dist/coaches/*.js|perl -lne '/(\w+)\.js/ && print qq!"$1":true,!')

perl -wpe 's!/\*KNOWN_COACH_TYPES\*/!'"$COACH_TYPES"'!' < nf.js | \
node_modules/uglifyjs/bin/uglifyjs -m > dist/nf.min.js

echo 'Now copy the dist/ directory to a location on an HTTPS server.'
