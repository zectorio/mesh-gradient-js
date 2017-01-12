
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
  // mantissa = this.ldexp(value, -exponent)  // not needed for Squeak
  return exponent;
}

function ldexp(mantissa, exponent) {
  // construct a float as mantissa * 2 ^ exponent
  // avoid multiplying by Infinity and Zero and rounding errors
  // by splitting the exponent (thanks to Nicolas Cellier)
  // 3 multiplies needed for e.g. ldexp(5e-324, 1023+1074)
  var steps = Math.min(3, Math.ceil(Math.abs(exponent) / 1023));
  var result = mantissa;
  for (var i = 0; i < steps; i++)
    result *= Math.pow(2, Math.floor((exponent + i) / steps));
  return result;
}

function sqStepsToShift(stepsSq)
{
  var r = frexp_exponent(Math.max(1.0, stepsSq));
  return (r+1) >> 1;
}

function fd_init(x, y, z, w)
{
  return [
    x,
    w-x,
    6. * (w - 2. * z + y),
    6. * (w - 3. * z + 3. * y - x)
  ];
}

function fd_down(f)
{
  f[3] *= 0.125;
  f[2] = f[2] * 0.25 - f[3];
  f[1] = (f[1] - f[2]) * 0.5;
}

function fd_fwd(f)
{
  f[0] += f[1];
  f[1] += f[2];
  f[2] += f[3];
}

function fd_fixed(f)
{
  return [
    Math.round(256 * 2 * f[0]),
    Math.round(256 * 16 * f[1]),
    Math.round(256 * 16 * f[2]),
    Math.round(256 * 16 * f[3])
  ];
}

function fd_fixed_fwd(f)
{
  f[0] += (f[1] >> 5) + ((f[1] >> 4) & 1);
  f[1] += f[2];
  f[2] += f[3];
}

function bezier_steps_sq (cpoints)
{
  var tmp = lenSq(cpoints[0], cpoints[1]);
  tmp = Math.max(tmp, lenSq(cpoints[2], cpoints[3]));
  tmp = Math.max(tmp, lenSq(cpoints[0], cpoints[2]) * .25);
  tmp = Math.max(tmp, lenSq(cpoints[1], cpoints[3]) * .25);
  return 18.0 * tmp;
}

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

var INSIDE = -1;
var OUTSIDE = 0;
var PARTIAL = 1;

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

function getRawColorAt(data, x, y, w, h) {
  var pos = 4*(y*w + x);
  return [
    data[pos], // Red
    data[pos+1], // Green
    data[pos+2], // Blue
    data[pos+3] // Alpha
  ];
}

function setRawColorAt(data, x, y, w, h, r, g, b, a) {
  var pos = 4*(y*w + x);
  data[pos] = r;
  data[pos+1] = g;
  data[pos+2] = b;
  data[pos+3] = a;
}

function draw_pixel(imgdata, width, height, coord, color)
{
  var x = coord[0];
  var y = coord[1];
  if(x >= 0 && y >= 0 && x < width && y < height) {
    console.log('['+x+','+y+'] ',color);
    setRawColorAt(imgdata, x, y, width, height,
      Math.round(color[0]), Math.round(color[1]), Math.round(color[2]), Math.round(color[3]));
  } else {
    console.warn('Ignoring out-of-bounds coord', coord);
  }
}

function rasterize_bezier_curve(imgdata, width, height,
  ushift, dxu, dyu, color0, color3)
{
  var xu = new Array(4);
  var yu = new Array(4);
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

  xu = fd_fixed(dxu);
  yu = fd_fixed(dyu);

  x0 = Math.round(dxu[0]);
  y0 = Math.round(dyu[0]);
  xu[0] = 0;
  yu[0] = 0;

  for(u=0; u<=usteps; ++u) {
    var x = Math.floor(x0 + (xu[0] >> 15) + ((xu[0] >> 14) & 1));
    var y = Math.floor(y0 + (yu[0] >> 15) + ((yu[0] >> 14) & 1));

    draw_pixel(imgdata, width, height, [x,y], [r,g,b,a]);

    fd_fixed_fwd(xu);
    fd_fixed_fwd(yu);

    r += dr;
    g += dg;
    b += db;
    a += da;
  }
}

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

    rasterize_bezier_curve(imgdata, width, height, ushift, xu, yu, c0, c3);

    draw_pixel(imgdata, width, height, p[3], c3);
  }
}
