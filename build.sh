#!/bin/sh

# Die on error
set -e

cd $(dirname $0)

# Fetch some prerequisites: SVG optimizer and JS minifier
if [ ! -d node_modules ]; then
  npm install
fi

# Fetch a patched version of pyswf
if [ ! -d pyswf ]; then
  git clone -b all-patches https://github.com/tuomassalo/pyswf.git
fi

if [ ! -d coachmap.swf ]; then
  curl https://shop.vr.fi/onlineshop/pages/static/flash/coachmap.swf > coachmap.swf
fi

if [ ! -d lxml ]; then
  pip install --target=. lxml==3.7.2
fi

mkdir -p dist/coaches
PYTHONPATH=.:./pyswf python parse-coachmap.py

# Just for seeing all the coaches at once
ls dist/coaches/*.svg | perl -F/ -awlne '
  BEGIN {
    print qq!<body style="background-color:#000; x-moz-column-count:7">!;
    print qq!<style>img {width:300px; padding: 5px; background:white; border-radius: 5px; margin: 4px}</style>!;
  }
  print qq!<a href="$F[-1]"><img src="$F[-1]"></a>!;
' > dist/coaches/all.html

echo 'To see all coaches, open dist/coaches/all.html'

# Populate the list of known coach types
COACH_TYPES=$(ls dist/coaches/*.js|perl -lne '/(\w+)\.js/ && print qq!"$1":true,!')

perl -wpe 's!/\*KNOWN_COACH_TYPES\*/!'"$COACH_TYPES"'!' < nf.js | \
npx uglify-js -m > dist/nf.min.js

echo 'Now copy the dist/ directory to a location on an HTTPS server.'
