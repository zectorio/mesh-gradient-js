
I started this project to add support for mesh gradients in [Zector Trace]
(http://zector.io/trace).

Linear and Radial gradients are just not enough to mimic the variations in
colors while tracing a bitmap image. Mesh gradients are however very flexible
and can match the natural variations in an image very closely. Unfortunately
SVG doesn't officially support mesh gradients in its spec, even though other
formats like PostScript and PDF do. There is a proposal for this and Inkscape
has gone ahead and implemented support for this. Unfortunately the SVG file
containing such mesh gradients cannot be rendered in browsers, because they
only abide by the standard spec.

However since SVG file format supports Javascript execution, we can alleviate
this problem by means of polyfill.

In this project I ported Cairo's algorithm for rendering mesh gradients into
Javascript.

Once having done that, I could use it to dynamically render mesh gradients when
SVG is loaded. So I wrote some polyfill code, which when embedded in SVG,
parses the DOM, detects elements with fill type mesh gradient, renders the
mesh gradients on canvas, packs the renders into an image element and adds them
behind the original element (original element is made transparent by setting
its fill to `none`).

