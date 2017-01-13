
var imgdata, W, H;

window.onload = function () {

  var canvas = document.querySelector('#output');
  W = canvas.width;
  H = canvas.height;

  var ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,W,H);

  imgdata = ctx.getImageData(0,0,W,H);

  drawPatch();
  //drawCurve();

  ctx.putImageData(imgdata, 0,0);

};

function drawPatch() {
  var patch1 = [
    [ [100,50], [200,100], [300,100], [400,50] ],
    [ [100,150], [200,150], [300,150], [400,150] ],
    [ [100,300], [200,350], [300,350], [400,300] ],
    [ [100,450], [200,400], [300,400], [400,450] ]
  ];
  var patch = [
    [ [100,100], [200,100], [300,100], [400,100] ],
    [ [100,200], [200,200], [300,200], [400,200] ],
    [ [100,300], [200,300], [300,300], [400,300] ],
    [ [100,400], [200,400], [300,400], [400,400] ]
  ];
  var colors = [
    [255,0,0,255], [0,255,0,255], [0,0,255,255], [255,255,0,255]
  ];

  draw_bezier_patch(imgdata.data, W, H, patch, colors);
}

function drawCurve() {
  var crv = [
    [100,200],
    [200,50],
    [300,250],
    [400,400]
  ];

  draw_bezier_curve(imgdata.data, W, H, crv, [255,0,0,255], [0,255,0,255]);
}
