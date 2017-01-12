
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
    [400,100]
  ];

  draw_bezier_curve(imgdata.data, W, H, crv, [255,0,0,255], [0,255,0,255]);

  ctx.putImageData(imgdata, 0,0);
};
