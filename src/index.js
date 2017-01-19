/**
 * The following code is Javascript port of original C code from Cairo
 * library (including most of the comments and references)
 * (cairo-mesh-pattern-rasterizer.c)
 */

/**
 * Rasterizer for mesh patterns.
 *
 * This implementation is based on techniques derived from several
 * papers (available from ACM):
 *
 * - Lien, Shantz and Pratt "Adaptive Forward Differencing for
 *   Rendering Curves and Surfaces" (discussion of the AFD technique,
 *   bound of 1/sqrt(2) on step length without proof)
 *
 * - Popescu and Rosen, "Forward rasterization" (description of
 *   forward rasterization, proof of the previous bound)
 *
 * - Klassen, "Integer Forward Differencing of Cubic Polynomials:
 *   Analysis and Algorithms"
 *
 * - Klassen, "Exact Integer Hybrid Subdivision and Forward
 *   Differencing of Cubics" (improving the bound on the minimum
 *   number of steps)
 *
 * - Chang, Shantz and Rocchetti, "Rendering Cubic Curves and Surfaces
 *   with Integer Adaptive Forward Differencing" (analysis of forward
 *   differencing applied to Bezier patches)
 *
 * Notes:
 * - Poor performance expected in degenerate cases
 *
 * - Patches mostly outside the drawing area are drawn completely (and
 *   clipped), wasting time
 *
 * - Both previous problems are greatly reduced by splitting until a
 *   reasonably small size and clipping the new tiles: execution time
 *   is quadratic in the convex-hull diameter instead than linear to
 *   the painted area. Splitting the tiles doesn't change the painted
 *   area but (usually) reduces the bounding box area (bbox area can
 *   remain the same after splitting, but cannot grow)
 *
 * - The initial implementation used adaptive forward differencing,
 *   but simple forward differencing scored better in benchmarks
 *
 * Idea:
 *
 * We do a sampling over the cubic patch with step du and dv (in the
 * two parameters) that guarantees that any point of our sampling will
 * be at most at 1/sqrt(2) from its adjacent points. In formulae
 * (assuming B is the patch):
 *
 *   |B(u,v) - B(u+du,v)| < 1/sqrt(2)
 *   |B(u,v) - B(u,v+dv)| < 1/sqrt(2)
 *
 * This means that every pixel covered by the patch will contain at
 * least one of the samples, thus forward rasterization can be
 * performed. Sketch of proof (from Popescu and Rosen):
 *
 * Let's take the P pixel we're interested into. If we assume it to be
 * square, its boundaries define 9 regions on the plane:
 *
 * 1|2|3
 * -+-+-
 * 8|P|4
 * -+-+-
 * 7|6|5
 *
 * Let's check that the pixel P will contain at least one point
 * assuming that it is covered by the patch.
 *
 * Since the pixel is covered by the patch, its center will belong to
 * (at least) one of the quads:
 *
 *   {(B(u,v), B(u+du,v), B(u,v+dv), B(u+du,v+dv)) for u,v in [0,1]}
 *
 * If P doesn't contain any of the corners of the quad:
 *
 * - if one of the corners is in 1,3,5 or 7, other two of them have to
 *   be in 2,4,6 or 8, thus if the last corner is not in P, the length
 *   of one of the edges will be > 1/sqrt(2)
 *
 * - if none of the corners is in 1,3,5 or 7, all of them are in 2,4,6
 *   and/or 8. If they are all in different regions, they can't
 *   satisfy the distance constraint. If two of them are in the same
 *   region (let's say 2), no point is in 6 and again it is impossible
 *   to have the center of P in the quad respecting the distance
 *   constraint (both these assertions can be checked by continuity
 *   considering the length of the edges of a quad with the vertices
 *   on the edges of P)
 *
 * Each of the cases led to a contradiction, so P contains at least
 * one of the corners of the quad.
 */

(function () {

  /*
   * Make sure that errors are less than 1 in fixed point math if you
   * change these values.
   *
   * The error is amplified by about steps^3/4 times.
   * The rasterizer always uses a number of steps that is a power of 2.
   *
   * 256 is the maximum allowed number of steps (to have error < 1)
   * using 8.24 for the differences.
   */
  var STEPS_MAX_V = 256.0;
  var STEPS_MAX_U = 256.0;

  /*
   * If the patch/curve is only partially visible, split it to a finer
   * resolution to get higher chances to clip (part of) it.
   *
   * These values have not been computed, but simply obtained
   * empirically (by benchmarking some patches). They should never be
   * greater than STEPS_MAX_V (or STEPS_MAX_U), but they can be as small
   * as 1 (depending on how much you want to spend time in splitting the
   * patch/curve when trying to save some rasterization time).
   */
  var STEPS_CLIP_V = 64.0;
  var STEPS_CLIP_U = 64.0;

  function lenSq(pa, pb)
  {
    var dx = pa[0]-pb[0];
    var dy = pa[1]-pb[1];
    return dx*dx + dy*dy;
  }

  function colorDeltaShiftedShort(from, to, shift)
  {
    var delta = to - from;
    // We need to round toward zero, because otherwise adding the
    // delta 2^shift times can overflow
    if (delta >= 0) {
      return delta >> shift;
    } else {
      return -((-delta) >> shift);
    }
  }

  /**
   * From the SqueakJS project
   */
  function frexp_exponent(value) {
    // frexp separates a float into its mantissa and exponent
    if (value == 0.0) return 0;     // zero is special
    var data = new DataView(new ArrayBuffer(8));
    data.setFloat64(0, value);      // for accessing IEEE-754 exponent bits
    var bits = (data.getUint32(0) >>> 20) & 0x7FF;
    if (bits === 0) { // we have a subnormal float (actual zero was handled above)
      // make it normal by multiplying a large number
      data.setFloat64(0, value * Math.pow(2, 64));
      // access its exponent bits, and subtract the large number's exponent
      bits = ((data.getUint32(0) >>> 20) & 0x7FF) - 64;
    }
    var exponent = bits - 1022;                 // apply bias
    return exponent;
  }

  function double_to_short(d) {
    return Math.round(d * 65535.0 + 0.5);
  }

  var MAGIC_NUMBER_FIXED_16_16 = 103079215104.0;
  function fixed_16_16_from_double(x) {
    var data = new DataView(new ArrayBuffer(8));
    data.setFloat64(0, x+MAGIC_NUMBER_FIXED_16_16);
    return data.getInt32(4);
  }

  var FIXED_FRAC_BITS	= 8;

  var MAGIC_NUMBER_FIXED = 26388279066624.000000;

  function fixed_from_double(x) {
    var data = new DataView(new ArrayBuffer(8));
    data.setFloat64(0, x+MAGIC_NUMBER_FIXED);
    return data.getInt32(4);
  }

  function fixed_integer_floor(x) {
    if(x >= 0) {
      return x >> FIXED_FRAC_BITS;
    } else {
      return -((-x - 1) >> FIXED_FRAC_BITS) - 1;
    }
  }

  function sqStepsToShift(stepsSq)
  {
    var r = frexp_exponent(Math.max(1.0, stepsSq));
    return (r+1) >> 1;
  }

  /*
   * FD functions
   *
   * A Bezier curve is defined (with respect to a parameter t in
   * [0,1]) from its nodes (x,y,z,w) like this:
   *
   *   B(t) = x(1-t)^3 + 3yt(1-t)^2 + 3zt^2(1-t) + wt^3
   *
   * To efficiently evaluate a Bezier curve, the rasterizer uses forward
   * differences. Given x, y, z, w (the 4 nodes of the Bezier curve), it
   * is possible to convert them to forward differences form and walk
   * over the curve using fd_init (), fd_down () and fd_fwd ().
   *
   * f[0] is always the value of the Bezier curve for "current" t.
   */

  /*
   * Initialize the coefficient for forward differences.
   *
   * Input: x,y,z,w are the 4 nodes of the Bezier curve
   *
   * Output: f[i] is the i-th difference of the curve
   *
   * f[0] is the value of the curve for t==0, i.e. f[0]==x.
   *
   * The initial step is 1; this means that each step increases t by 1
   * (so fd_init () immediately followed by fd_fwd (f) n times makes
   * f[0] be the value of the curve for t==n).
   */
  function fd_init(x, y, z, w)
  {
    return [
      x,
      w-x,
      6. * (w - 2. * z + y),
      6. * (w - 3. * z + 3. * y - x)
    ];
  }

  /*
   * Halve the step of the coefficients for forward differences.
   *
   * Input: f[i] is the i-th difference of the curve
   *
   * Output: f[i] is the i-th difference of the curve with half the
   *         original step
   *
   * f[0] is not affected, so the current t is not changed.
   *
   * The other coefficients are changed so that the step is half the
   * original step. This means that doing fd_fwd (f) n times with the
   * input f results in the same f[0] as doing fd_fwd (f) 2n times with
   * the output f.
   */
  function fd_down(f)
  {
    f[3] *= 0.125;
    f[2] = f[2] * 0.25 - f[3];
    f[1] = (f[1] - f[2]) * 0.5;
  }

  /*
   * Perform one step of forward differences along the curve.
   *
   * Input: f[i] is the i-th difference of the curve
   *
   * Output: f[i] is the i-th difference of the curve after one step
   */
  function fd_fwd(f)
  {
    f[0] += f[1];
    f[1] += f[2];
    f[2] += f[3];
  }

  /*
   * Transform to integer forward differences.
   *
   * Input: d[n] is the n-th difference (in double precision)
   *
   * Output: i[n] is the n-th difference (in fixed point precision)
   *
   * i[0] is 9.23 fixed point, other differences are 4.28 fixed point.
   */
  function fd_fixed(f)
  {
    return [
      fixed_16_16_from_double(256 * 2 * f[0]),
      fixed_16_16_from_double(256 * 16 * f[1]),
      fixed_16_16_from_double(256 * 16 * f[2]),
      fixed_16_16_from_double(256 * 16 * f[3])
    ];
  }

  /*
   * Perform one step of integer forward differences along the curve.
   *
   * Input: f[n] is the n-th difference
   *
   * Output: f[n] is the n-th difference
   *
   * f[0] is 9.23 fixed point, other differences are 4.28 fixed point.
   */
  function fd_fixed_fwd(f)
  {
    f[0] += (f[1] >> 5) + ((f[1] >> 4) & 1);
    f[1] += f[2];
    f[2] += f[3];
  }

  /*
   * Compute the minimum number of steps that guarantee that walking
   * over a curve will leave no holes.
   *
   * Input: p[0..3] the nodes of the Bezier curve
   *
   * Returns: the square of the number of steps
   *
   * Idea:
   *
   * We want to make sure that at every step we move by less than
   * 1/sqrt(2).
   *
   * The derivative of the cubic Bezier with nodes (p0, p1, p2, p3) is
   * the quadratic Bezier with nodes (p1-p0, p2-p1, p3-p2) scaled by 3,
   * so (since a Bezier curve is always bounded by its convex hull), we
   * can say that:
   *
   *  max(|B'(t)|) <= 3 max (|p1-p0|, |p2-p1|, |p3-p2|)
   *
   * We can improve this by noticing that a quadratic Bezier (a,b,c) is
   * bounded by the quad (a,lerp(a,b,t),lerp(b,c,t),c) for any t, so
   * (substituting the previous values, using t=0.5 and simplifying):
   *
   *  max(|B'(t)|) <= 3 max (|p1-p0|, |p2-p0|/2, |p3-p1|/2, |p3-p2|)
   *
   * So, to guarantee a maximum step length of 1/sqrt(2) we must do:
   *
   *   3 max (|p1-p0|, |p2-p0|/2, |p3-p1|/2, |p3-p2|) sqrt(2) steps
   */
  function bezier_steps_sq (cpoints)
  {
    var tmp = lenSq(cpoints[0], cpoints[1]);
    tmp = Math.max(tmp, lenSq(cpoints[2], cpoints[3]));
    tmp = Math.max(tmp, lenSq(cpoints[0], cpoints[2]) * .25);
    tmp = Math.max(tmp, lenSq(cpoints[1], cpoints[3]) * .25);
    return 18.0 * tmp;
  }

  /*
   * Split a 1D Bezier cubic using de Casteljau's algorithm.
   *
   * Input: x,y,z,w the nodes of the Bezier curve
   *
   * Output: x0,y0,z0,w0 and x1,y1,z1,w1 are respectively the nodes of
   *         the first half and of the second half of the curve
   *
   * The output control nodes have to be distinct.
   */
  function split_bezier_1d(x,y,z,w)
  {
    var x0 = x;
    var w1 = w;

    var tmp = 0.5 * (y + z);
    var y0 = 0.5 * (x + y);
    var z1 = 0.5 * (z + w);

    var z0 = 0.5 * (y0 + tmp);
    var y1 = 0.5 * (tmp + z1);

    var w0, x1;
    w0 = x1 = 0.5 * (z0 + y1);

    return [
      [x0,y0,z0,w0],
      [x1,y1,z1,w1]
    ];
  }

  /*
   * Split a Bezier curve using de Casteljau's algorithm.
   *
   * Input: p[0..3] the nodes of the Bezier curve
   *
   * Output: fst_half[0..3] and snd_half[0..3] are respectively the
   *         nodes of the first and of the second half of the curve
   *
   * fst_half and snd_half must be different, but they can be the same as
   * nodes.
   */
  function split_bezier(p)
  {
    var xvals = split_bezier_1d(p[0][0], p[1][0], p[2][0], p[3][0]);
    var yvals = split_bezier_1d(p[0][1], p[1][1], p[2][1], p[3][1]);
    var firstHalf = [
      [ xvals[0][0], yvals[0][0] ],
      [ xvals[0][1], yvals[0][1] ],
      [ xvals[0][2], yvals[0][2] ],
      [ xvals[0][3], yvals[0][3] ]
    ];
    var secondHalf = [
      [ xvals[1][0], yvals[1][0] ],
      [ xvals[1][1], yvals[1][1] ],
      [ xvals[1][2], yvals[1][2] ],
      [ xvals[1][3], yvals[1][3] ]
    ];
    return [firstHalf, secondHalf];
  }

  var INSIDE = -1; /* the interval is entirely contained in the reference interval */
  var OUTSIDE = 0; /* the interval has no intersection with the reference interval */
  var PARTIAL = 1; /* the interval intersects the reference interval (but is not fully inside it) */

  /*
   * Check if an interval if inside another.
   *
   * Input: a,b are the extrema of the first interval
   *        c,d are the extrema of the second interval
   *
   * Returns: INSIDE  iff [a,b) intersection [c,d) = [a,b)
   *          OUTSIDE iff [a,b) intersection [c,d) = {}
   *          PARTIAL otherwise
   *
   * The function assumes a < b and c < d
   *
   * Note: Bitwise-anding the results along each component gives the
   *       expected result for [a,b) x [A,B) intersection [c,d) x [C,D).
   */
  function intersect_interval(a, b, c, d)
  {
    if (c <= a && b <= d) {
      return INSIDE;
    } else if (a >= d || b <= c) {
      return OUTSIDE;
    } else {
      return PARTIAL;
    }
  }

  function setRawColorAt(data, x, y, w, h, r, g, b, a) {
    var pos = 4*(y*w + x);
    data[pos] = r;
    data[pos+1] = g;
    data[pos+2] = b;
    data[pos+3] = a;
  }

  var NPIXELS = 0;

  /*
   * Set the color of a pixel.
   *
   * Input: data is the base pointer of the image
   *        width, height are the dimensions of the image
   *        stride is the stride in bytes between adjacent rows
   *        x, y are the coordinates of the pixel to be colored
   *        r,g,b,a are the color components of the color to be set
   *
   * Output: the (x,y) pixel in data has the (r,g,b,a) color
   *
   * The input color components are not premultiplied, but the data
   * stored in the image is assumed to be in CAIRO_FORMAT_ARGB32 (8 bpc,
   * premultiplied).
   *
   * If the pixel to be set is outside the image, this function does
   * nothing.
   */
  function draw_pixel(imgdata, width, height, coord, color)
  {
    var x = coord[0];
    var y = coord[1];
    if(x >= 0 && y >= 0 && x <= width && y <= height) {

      // console.assert(!isNaN(color[0]));
      // console.assert(!isNaN(color[1]));
      // console.assert(!isNaN(color[2]));
      // console.assert(!isNaN(color[3]));

      var r = color[0]/65535.0;
      var g = color[1]/65535.0;
      var b = color[2]/65535.0;
      var a = color[3]/65535.0;

      setRawColorAt(imgdata, x, y, width, height, r, g, b, a);

      NPIXELS++;
    } else {
      console.warn('Ignoring out-of-bounds coord', coord);
    }
  }

  /*
   * Forward-rasterize a cubic curve using forward differences.
   *
   * Input: data is the base pointer of the image
   *        width, height are the dimensions of the image
   *        stride is the stride in bytes between adjacent rows
   *        ushift is log2(n) if n is the number of desired steps
   *        dxu[i], dyu[i] are the x,y forward differences of the curve
   *        r0,g0,b0,a0 are the color components of the start point
   *        r3,g3,b3,a3 are the color components of the end point
   *
   * Output: data will be changed to have the requested curve drawn in
   *         the specified colors
   *
   * The input color components are not premultiplied, but the data
   * stored in the image is assumed to be in CAIRO_FORMAT_ARGB32 (8 bpc,
   * premultiplied).
   *
   * The function draws n+1 pixels, that is from the point at step 0 to
   * the point at step n, both included. This is the discrete equivalent
   * to drawing the curve for values of the interpolation parameter in
   * [0,1] (including both extremes).
   */
  function rasterize_bezier_curve(imgdata, width, height,
    ushift, dxu, dyu, color0, color3)
  {
    var x0, y0, u;
    var usteps = 1 << ushift;

    var r0 = color0[0];
    var g0 = color0[1];
    var b0 = color0[2];
    var a0 = color0[3];

    var r = r0;
    var g = g0;
    var b = b0;
    var a = a0;

    var r3 = color3[0];
    var g3 = color3[1];
    var b3 = color3[2];
    var a3 = color3[3];

    var dr = colorDeltaShiftedShort(r0, r3, ushift);
    var dg = colorDeltaShiftedShort(g0, g3, ushift);
    var db = colorDeltaShiftedShort(b0, b3, ushift);
    var da = colorDeltaShiftedShort(a0, a3, ushift);

    var xu = fd_fixed(dxu);
    var yu = fd_fixed(dyu);

    /*
     * Use (dxu[0],dyu[0]) as origin for the forward differences.
     *
     * This makes it possible to handle much larger coordinates (the
     * ones that can be represented as cairo_fixed_t)
     */
    x0 = fixed_from_double(dxu[0]);
    y0 = fixed_from_double(dyu[0]);
    xu[0] = 0;
    yu[0] = 0;

    for(u=0; u<=usteps; ++u) {
      /*
       * This rasterizer assumes that pixels are integer aligned
       * squares, so a generic (x,y) point belongs to the pixel with
       * top-left coordinates (floor(x), floor(y))
       */

      var x = fixed_integer_floor(x0 + (xu[0] >> 15) + ((xu[0] >> 14) & 1));
      var y = fixed_integer_floor(y0 + (yu[0] >> 15) + ((yu[0] >> 14) & 1));

      draw_pixel(imgdata, width, height, [x,y], [r,g,b,a]);

      fd_fixed_fwd(xu);
      fd_fixed_fwd(yu);

      r += dr;
      g += dg;
      b += db;
      a += da;
    }
  }

  /*
   * Clip, split and rasterize a Bezier curve.
   *
   * Input: data is the base pointer of the image
   *        width, height are the dimensions of the image
   *        stride is the stride in bytes between adjacent rows
   *        p[i] is the i-th node of the Bezier curve
   *        c0[i] is the i-th color component at the start point
   *        c3[i] is the i-th color component at the end point
   *
   * Output: data will be changed to have the requested curve drawn in
   *         the specified colors
   *
   * The input color components are not premultiplied, but the data
   * stored in the image is assumed to be in CAIRO_FORMAT_ARGB32 (8 bpc,
   * premultiplied).
   *
   * The color components are red, green, blue and alpha, in this order.
   *
   * The function guarantees that it will draw the curve with a step
   * small enough to never have a distance above 1/sqrt(2) between two
   * consecutive points (which is needed to ensure that no hole can
   * appear when using this function to rasterize a patch).
   */
  function draw_bezier_curve(imgdata, width, height, p, c0, c3)
  {
    var i;
    var top = p[0][1];
    var bottom = p[0][1];
    for(i=1; i<4; ++i) {
      top = Math.min(top, p[i][1]);
      bottom = Math.max(bottom, p[i][1]);
    }

    var v = intersect_interval(top, bottom, 0, height);
    if(v === OUTSIDE) {
      return;
    }

    var left = p[0][0];
    var right = p[0][0];
    for(i=1; i<4; ++i) {
      left = Math.min(left, p[i][0]);
      right = Math.max(right, p[i][0]);
    }

    v &= intersect_interval(left, right, 0, width);

    if(v === OUTSIDE) {
      return;
    }

    var stepsSq = bezier_steps_sq(p);

    if (stepsSq >=
      (v == INSIDE ? STEPS_MAX_U * STEPS_MAX_U : STEPS_CLIP_U * STEPS_CLIP_U))
    {
      /*
       * The number of steps is greater than the threshold. This
       * means that either the error would become too big if we
       * directly rasterized it or that we can probably save some
       * time by splitting the curve and clipping part of it
       */
      var midc = new Array(4);
      var result = split_bezier (p);
      var first = result[0];
      var second = result[1];
      midc[0] = (c0[0] + c3[0]) * 0.5;
      midc[1] = (c0[1] + c3[1]) * 0.5;
      midc[2] = (c0[2] + c3[2]) * 0.5;
      midc[3] = (c0[3] + c3[3]) * 0.5;
      draw_bezier_curve (imgdata, width, height, first, c0, midc);
      draw_bezier_curve (imgdata, width, height, second, midc, c3);
    } else {
      var ushift = sqStepsToShift(stepsSq);

      var xu = fd_init(p[0][0], p[1][0], p[2][0], p[3][0]);
      var yu = fd_init(p[0][1], p[1][1], p[2][1], p[3][1]);

      for(var k=0; k<ushift; ++k) {
        fd_down(xu);
        fd_down(yu);
      }

      var ic0 = [
        double_to_short(c0[0]),
        double_to_short(c0[1]),
        double_to_short(c0[2]),
        double_to_short(c0[3])
      ];
      var ic3 = [
        double_to_short(c3[0]),
        double_to_short(c3[1]),
        double_to_short(c3[2]),
        double_to_short(c3[3])
      ];
      rasterize_bezier_curve(imgdata, width, height, ushift, xu, yu, ic0, ic3);

      /* Draw the end point, to make sure that we didn't leave it
       * out because of rounding */
      draw_pixel(imgdata, width, height, p[3], c3);
    }
  }

  /*
   * Forward-rasterize a cubic Bezier patch using forward differences.
   *
   * Input: data is the base pointer of the image
   *        width, height are the dimensions of the image
   *        stride is the stride in bytes between adjacent rows
   *        vshift is log2(n) if n is the number of desired steps
   *        p[i][j], p[i][j] are the the nodes of the Bezier patch
   *        col[i][j] is the j-th color component of the i-th corner
   *
   * Output: data will be changed to have the requested patch drawn in
   *         the specified colors
   *
   * The nodes of the patch are as follows:
   *
   * u\v 0    - >    1
   * 0  p00 p01 p02 p03
   * |  p10 p11 p12 p13
   * v  p20 p21 p22 p23
   * 1  p30 p31 p32 p33
   *
   * i.e. u varies along the first component (rows), v varies along the
   * second one (columns).
   *
   * The color components are red, green, blue and alpha, in this order.
   * c[0..3] are the colors in p00, p30, p03, p33 respectively
   *
   * The input color components are not premultiplied, but the data
   * stored in the image is assumed to be in CAIRO_FORMAT_ARGB32 (8 bpc,
   * premultiplied).
   *
   * If the patch folds over itself, the part with the highest v
   * parameter is considered above. If both have the same v, the one
   * with the highest u parameter is above.
   *
   * The function draws n+1 curves, that is from the curve at step 0 to
   * the curve at step n, both included. This is the discrete equivalent
   * to drawing the patch for values of the interpolation parameter in
   * [0,1] (including both extremes).
   */
  function rasterize_bezier_patch(imgdata, width, height, vshift, p, col)
  {
    var i,k;
    var pv = [[],[],[],[]];
    var cstart = [];
    var cend = [];
    var dcstart = [];
    var dcend = [];

    var v = 1 << vshift;

    /*
     * pv[i][0] is the function (represented using forward
     * differences) mapping v to the x coordinate of the i-th node of
     * the Bezier curve with parameter u.
     * (Likewise p[i][0] gives the y coordinate).
     *
     * This means that (pv[0][0][0],pv[0][1][0]),
     * (pv[1][0][0],pv[1][1][0]), (pv[2][0][0],pv[2][1][0]) and
     * (pv[3][0][0],pv[3][1][0]) are the nodes of the Bezier curve for
     * the "current" v value (see the FD comments for more details).
     */
    for(i=0; i<4; ++i) {
      pv[i][0] = fd_init(p[i][0][0], p[i][1][0], p[i][2][0], p[i][3][0]);
      pv[i][1] = fd_init(p[i][0][1], p[i][1][1], p[i][2][1], p[i][3][1]);

      for(k=0; k<vshift; ++k) {
        fd_down(pv[i][0]);
        fd_down(pv[i][1]);
      }
    }

    for(i=0; i<4; ++i) {
      cstart[i] = col[0][i];
      cend[i] = col[1][i];
      dcstart[i] = (col[2][i] - col[0][i])/v;
      dcend[i] = (col[3][i] - col[1][i])/v;
    }

    v++;

    while(v--) {
      var nodes = [];
      for(i=0; i<4; ++i) {
        nodes[i] = [
          pv[i][0][0],
          pv[i][1][0]
        ]
      }

      draw_bezier_curve(imgdata, width, height, nodes, cstart, cend);

      for(i=0; i<4; ++i) {
        fd_fwd(pv[i][0]);
        fd_fwd(pv[i][1]);
        cstart[i] += dcstart[i];
        cend[i] += dcend[i];
      }
    }
  }

  /*
   * Clip, split and rasterize a Bezier cubic patch.
   *
   * Input: data is the base pointer of the image
   *        width, height are the dimensions of the image
   *        stride is the stride in bytes between adjacent rows
   *        p[i][j], p[i][j] are the nodes of the patch
   *        col[i][j] is the j-th color component of the i-th corner
   *
   * Output: data will be changed to have the requested patch drawn in
   *         the specified colors
   *
   * The nodes of the patch are as follows:
   *
   * u\v 0    - >    1
   * 0  p00 p01 p02 p03
   * |  p10 p11 p12 p13
   * v  p20 p21 p22 p23
   * 1  p30 p31 p32 p33
   *
   * i.e. u varies along the first component (rows), v varies along the
   * second one (columns).
   *
   * The color components are red, green, blue and alpha, in this order.
   * c[0..3] are the colors in p00, p30, p03, p33 respectively
   *
   * The input color components are not premultiplied, but the data
   * stored in the image is assumed to be in CAIRO_FORMAT_ARGB32 (8 bpc,
   * premultiplied).
   *
   * If the patch folds over itself, the part with the highest v
   * parameter is considered above. If both have the same v, the one
   * with the highest u parameter is above.
   *
   * The function guarantees that it will draw the patch with a step
   * small enough to never have a distance above 1/sqrt(2) between two
   * adjacent points (which guarantees that no hole can appear).
   *
   * This function can be used to rasterize a tile of PDF type 7
   * shadings (see http://www.adobe.com/devnet/pdf/pdf_reference.html).
   */
  function draw_bezier_patch(imgdata, width, height, p, c)
  {
    var i, j, v;
    var top, bottom;
    top = bottom = p[0][0][1];
    for(i=0; i<4; ++i) {
      for(j=0; j<4; ++j) {
        top = Math.min(top, p[i][j][1]);
        bottom = Math.max(bottom, p[i][j][1]);
      }
    }
    v = intersect_interval(top, bottom, 0, height);
    if(v === OUTSIDE) {
      return;
    }

    var left, right;
    left = right = p[0][0][0];
    for(i=0; i<4; ++i) {
      for(j=0; j<4; ++j) {
        left = Math.min(left, p[i][j][0]);
        right = Math.max(right, p[i][j][0]);
      }
    }

    v &= intersect_interval(left, right, 0, width);

    if(v === OUTSIDE) {
      return;
    }

    var stepsSq = 0;
    for(i=0; i<4; ++i) {
      stepsSq = Math.max(stepsSq, bezier_steps_sq(p[i]));
    }

    if(stepsSq >= (v == INSIDE ? STEPS_MAX_V * STEPS_MAX_V : STEPS_CLIP_V * STEPS_CLIP_V))
    {
      /* The number of steps is greater than the threshold. This
       * means that either the error would become too big if we
       * directly rasterized it or that we can probably save some
       * time by splitting the curve and clipping part of it. The
       * patch is only split in the v direction to guarantee that
       * rasterizing each part will overwrite parts with low v with
       * overlapping parts with higher v. */
      var first = [];
      var second = [];
      var subc = [new Array(4), new Array(4), new Array(4), new Array(4)];

      for(i=0; i<4; ++i) {
        var result = split_bezier(p[i]);
        first[i] = result[0];
        second[i] = result[1];
      }

      for(i=0; i<4; ++i) {
        subc[0][i] = c[0][i];
        subc[1][i] = c[1][i];
        subc[2][i] = 0.5 * (c[0][i] + c[2][i]);
        subc[3][i] = 0.5 * (c[1][i] + c[3][i]);
      }

      draw_bezier_patch(imgdata, width, height, first, subc);

      for(i=0; i<4; ++i) {
        subc[0][i] = subc[2][i];
        subc[1][i] = subc[3][i];
        subc[2][i] = c[2][i];
        subc[3][i] = c[3][i];
      }

      draw_bezier_patch(imgdata, width, height, second, subc);

    } else {
      rasterize_bezier_patch(imgdata, width, height, sqStepsToShift(stepsSq), p, c);
    }
  }

  /*
   * Coons patch is defined by its boundary.
   * A mesh gradient coons patch is defined by 4 cubic bezier curves.
   * Hence there are expected to be 12 points on its boundaries. This routine
   * computes the 4 inside control points for such coons patch
   */
  function interpolateCoons(coons) {
    if(coons.length !== 12) {
      console.error("Coons boundary of unexpected length", coons.length);
    }
    var patch = [
      [ coons[0], coons[1], coons[2], coons[3] ],
      [ coons[11], null, null, coons[4] ],
      [ coons[10], null, null, coons[5] ],
      [ coons[9], coons[8], coons[7], coons[6] ]
    ];
    // TODO : following is very simplistic and incorrect interpolation
    var pa, pb;

    pa = coons[1];
    pb = coons[8];
    patch[1][1] = [ pa[0] + (1/3)*(pb[0]-pa[0]), pa[1] + (1/3)*(pb[1]-pa[1]) ];
    patch[2][1] = [ pa[0] + (2/3)*(pb[0]-pa[0]), pa[1] + (2/3)*(pb[1]-pa[1]) ];

    pa = coons[2];
    pb = coons[7];
    patch[1][2] = [ pa[0] + (1/3)*(pb[0]-pa[0]), pa[1] + (1/3)*(pb[1]-pa[1]) ];
    patch[2][2] = [ pa[0] + (2/3)*(pb[0]-pa[0]), pa[1] + (2/3)*(pb[1]-pa[1]) ];
    return patch;
  }

  /*
   * This is the public function called by outside code to draw mesh gradient
   * The colors in mesh gradient specification are in different order than
   * the order used in above code. Hence this routine reorders them.
   * It also interpolates the input coons patch.
   */
  function drawMeshGradientPatch(imgdata, width, height, coons, colors)
  {
    var reorderedColors = [
      colors[0],
      colors[3],
      colors[1],
      colors[2]
    ];
    var cpoints = interpolateCoons(coons);
    draw_bezier_patch(imgdata, width, height, cpoints, reorderedColors);
  }

  if(typeof window !== "undefined") {
    window.drawMeshGradientPatch = drawMeshGradientPatch;
  } else if(typeof module !== "undefined") {
    module.exports = {drawMeshGradientPatch:drawMeshGradientPatch};
  }

})();
