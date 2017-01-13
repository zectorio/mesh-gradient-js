
var imgdata, W, H;

window.onload = function () {

  var canvas = document.querySelector('#output');
  W = canvas.width;
  H = canvas.height;

  var ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,W,H);

  var t0 = new Date();
  imgdata = ctx.getImageData(0,0,W,H);

  drawPatch();
  //drawCurve();
  console.log(NPIXELS);

  ctx.putImageData(imgdata, 0,0);

  var t1 = new Date();
  console.log((t1-t0)+' msec');
};

function drawPatch() {
  var patch1 = [
    [ [100,50], [200,100], [300,100], [310,50] ],
    [ [100,150], [200,150], [300,150], [400,150] ],
    [ [100,300], [200,350], [300,350], [450,300] ],
    [ [100,450], [200,400], [300,400], [400,450] ]
  ];
  var patch2 = [
    [ [100,100], [200,100], [300,100], [400,100] ],
    [ [100,200], [200,200], [300,200], [400,200] ],
    [ [100,300], [200,300], [300,300], [400,300] ],
    [ [100,400], [200,400], [300,400], [400,400] ]
  ];
  var patch = [
    [ [10,10], [20,10], [30,10], [40,10] ],
    [ [10,20], [20,20], [30,20], [40,20] ],
    [ [10,30], [20,30], [30,30], [40,30] ],
    [ [10,40], [20,40], [30,40], [40,40] ]
  ];
  var colors = [
    [255,0,0,255], [0,255,0,255], [0,0,255,255], [255,255,0,255]
  ];

  draw_bezier_patch(imgdata.data, W, H, patch1, colors);
}

function drawCurve() {
  var crv = [
    [100,200],
    [200,50],
    [300,250],
    [400,200]
  ];

  draw_bezier_curve(imgdata.data, W, H, crv, [255,0,0,255], [0,255,0,255]);
}
