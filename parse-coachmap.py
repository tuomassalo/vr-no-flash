#!/usr/bin/env python

"""
Read coachmap.swf and export all coaches to dist/coaches/*.{svg,js}.
"""

from swf.movie import SWF
from swf.export import SVGExporter, SingleShapeSVGExporterMixin, FrameSVGExporterMixin, NamesSVGExporterMixin
from swf.tag import TagPlaceObject, TagDefineShape, TagDefineSprite, TagFrameLabel
from subprocess import call
import json

print "Parsing..."
swf = SWF(open('coachmap.swf'))

# NB: the order of these mixins matter.
class CoachExporter(SingleShapeSVGExporterMixin, FrameSVGExporterMixin, NamesSVGExporterMixin, SVGExporter):
  pass

exporter = CoachExporter()

# 1) Find the PlaceObject tag "floorplan".
placeobject = [x for x in swf.all_tags_of_type(TagPlaceObject) if x.instanceName == 'floorplan'][0]

# 2) Find corresponding DefineSprite.
sprite = [x for x in swf.all_tags_of_type((TagDefineShape, TagDefineSprite)) if x.characterId == placeobject.characterId][0]

# 3) Remove background (id=362) to get a tight viewbox for each coach type.
sprite.tags = [t for t in sprite.tags if not hasattr(t, 'characterId') or t.characterId != 362]

# 4) Remove filter from placeobject so there's something to see.
placeobject.colorTransform = None
placeobject.hasColorTransform = False

coaches = list(sprite.all_tags_of_type(TagFrameLabel))

# 5) For all coaches:
#    - export to dist/coaches/*.svg
#    - optimize (in-place)
#    - wrap in dist/coaches/*.js

for (frame_idx, coach_type) in enumerate([l.frameName for l in coaches]):

  # To test a single coach type:
  # if coach_type != 'A40':
  #   continue

  print "Converting frame %d/%d: %s" % (frame_idx, len(coaches)-1, coach_type)

  svg = exporter.export(swf, shape=sprite, frame=frame_idx)

  svg_filename = "dist/coaches/%s.svg" % coach_type
  out = open(svg_filename, "w")
  out.write(svg.read())
  out.close()

  # optimize:
  # convertPathData would halve the filesize, but is buggy, see https://github.com/svg/svgo/issues/483
  # call(["node_modules/svgo/bin/svgo", "--disable", "convertPathData", "--quiet", svg_filename])
  call(["node_modules/svgo/bin/svgo", "--quiet", svg_filename])

  with open(svg_filename, 'r') as final_svg:
    js_contents = "nfDefineCoach(%s)" % json.dumps(dict(type=coach_type, svg=final_svg.read()))
    js_filename = svg_filename.replace('.svg', '.js')
    out_js = open(js_filename, "w")
    out_js.write(js_contents)
    out_js.close()



