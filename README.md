
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
this problem by means of polyfill (as suggested [here](http://tavmjong.free.fr/svg2_status.html)).

In this project I ported Cairo's algorithm for rendering mesh gradients to
Javascript.

Once having done that, I could use it to dynamically render mesh gradients when
SVG is loaded. So I wrote some polyfill code, which when embedded in SVG,
parses the DOM, detects elements with fill type mesh gradient, renders the
mesh gradients on canvas, packs the renders into an image element and adds them
behind the original element (original element is made transparent by setting
its fill to `none`).

Check out the [samples](https://github.com/zectorio/mesh-gradient-js/tree/master/samples)
directory for example SVGs with mesh gradients and polyfill. **Note that if you
open the *-with-polyfill.svg files in github, you won't see the mesh gradients
rendered, because for security reasons Github won't execute embedded javascript
polyfill in that file. Download those files and open them in your browser from
disk to see the correct result**

How to use?
============

    git clone https://github.com/zectorio/mesh-gradient-js.git
    cd mesh-gradient-js
    npm run addpolyfill <SVG-filename>


Development
===========

If you make changes to the source and want to test it

    npm run addpolyfill <SVG-filename> dev

If you want to build minified polyfill

    npm install
    npm run build
    npm run addpolyfill <SVG-filename>

References
==========

* [http://tavmjong.free.fr/SVG/MESH/Mesh.html](http://tavmjong.free.fr/SVG/MESH/Mesh.html)

