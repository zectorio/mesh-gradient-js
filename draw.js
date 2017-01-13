
window.onload = function () {

  var canvas = document.querySelector('#output');
  var W = canvas.width;
  var H = canvas.height;

  var ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ddf';
  ctx.fillRect(0,0,W,H);

  var imgdata = ctx.getImageData(0,0,W,H);

  var crv = [
    [100,200],
    [200,50],
    [300,250],
    [400,400]
  ];

  draw_bezier_curve(imgdata.data, W, H, crv, [255,0,0,255], [0,255,0,255]);

  ctx.putImageData(imgdata, 0,0);

  /*
  var values = [
    0.0,
    1.0,
    0.5,
    1.908,
    0.0004,
    7.880000087,
    45453535313434.89
  ];

  for(var i=0; i<values.length; i++) {
    // console.log(values[i], '=>', fixed_from_double(values[i]));
  }

  var intvalues = [
    0,
    1,
    2323,
    2334343,
    324,
    4535,
    02323
  ];

  for(var i=0; i<values.length; i++) {
    console.log(intvalues[i], '=>', fixed_integer_floor(intvalues[i]));
  }
  */
};
