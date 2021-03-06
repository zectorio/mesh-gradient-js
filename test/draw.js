
var canvas, imgdata, W, H;

var NS_SVG = 'http://www.w3.org/2000/svg';

var data = {
  'twisted1' : {
    patch :[
      [ [100,50], [200,100], [300,100], [310,50] ],
      [ [100,150], [200,150], [300,150], [400,150] ],
      [ [100,300], [200,350], [300,350], [450,300] ],
      [ [100,450], [200,400], [300,400], [400,450] ]
    ],
    colors : [[255,0,0,255], [0,255,0,255], [0,0,255,255], [255,255,0,255]]
  },
  'twisted1coons' : {
    coons :[
      [100,50], [200,100], [300,100], [310,50],
      [400,150], [450,300], [400,450], [300,400],
      [200,400], [100,450], [100,300], [100,150]
    ],
    colors : [[255,0,0,255], [0,255,0,255], [0,0,255,255], [255,255,0,255]]
  },
  'square': {
    patch : [
      [ [100,100], [200,100], [300,100], [400,100] ],
      [ [100,200], [200,200], [300,200], [400,200] ],
      [ [100,300], [200,300], [300,300], [400,300] ],
      [ [100,400], [200,400], [300,400], [400,400] ]
    ],
    colors : [[255,0,0,255], [0,255,0,255], [0,0,255,255], [255,255,0,255]]
  },
  'squarecoons': {
    coons : [
      [100,100], [200,100], [300,100], [400,100],
      [400,200], [400,300], [400,400], [300,400],
      [200,400], [100,400], [100,300], [100,200]
    ],
    colors : [[255,0,0,255], [0,255,0,255], [0,0,255,255], [255,255,0,255]]
  },
  'trishape' : {
    patch : [
      [ [100,100], [200,100], [300,100], [400,100] ],
      [ [100,200], [200,200], [300,200], [400,200] ],
      [ [100,300], [200,300], [300,300], [400,300] ],
      [ [250,400], [250,400], [250,400], [250,400] ]
    ],
    colors : [[255,0,0,255], [0,255,0,255], [0,0,255,255], [0,255,0,255]]
  },
  'twoshape' : {
    patch : [
      [ [250,100], [250,100], [250,100], [250,100] ],
      [ [100,200], [200,200], [300,200], [400,200] ],
      [ [100,300], [200,300], [300,300], [400,300] ],
      [ [250,400], [250,400], [250,400], [250,400] ]
    ],
    colors : [[255,0,0,255], [0,255,0,255], [255,0,0,255], [0,255,0,255]]
  }
};

activeSample = data.twisted1;

window.onload = function () {

  canvas = document.querySelector('#output');
  W = canvas.width;
  H = canvas.height;

  var svg = document.querySelector('#controls');
  svg.onmousemove = onCanvasMouseMove;

  drawCanvas();
  if(activeSample.patch) {
    createGridHandles(activeSample.patch);
  } else if(activeSample.coons) {
    createBoundaryHandles(activeSample.coons);
  }
};

var activeSample;

function drawPatch() {
  var t0 = new Date();
  if(activeSample.patch) {
    console.log('grid');
    draw_bezier_patch(imgdata.data, W, H, activeSample.patch, activeSample.colors);
  } else if(activeSample.coons) {
    console.log('coons');
    var patch = interpolateCoons(activeSample.coons);
    draw_bezier_patch(imgdata.data, W, H, patch, activeSample.colors);
  }
  var t1 = new Date();
  console.log(t1-t0,'msec');
}

function drawCanvas() {

  var ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,W,H);

  imgdata = ctx.getImageData(0,0,W,H);

  drawPatch();

  ctx.putImageData(imgdata, 0,0);

}

function redraw() {
  drawCanvas();
  updateHandles();
}

var controlsArray = [];

function onCanvasMouseMove(ev) {
  for(var k=0; k<controlsArray.length; k++) {
    if(controlsArray[k].dragged) {
      var i = controlsArray[k].position[0];
      var j = controlsArray[k].position[1];
      activeSample.patch[i][j] = [ev.clientX, ev.clientY];
      redraw();
    }
  }

}

function onMouseDown(ev) {
  var idx = parseInt(/c(\d+)/.exec(ev.target.getAttribute('id'))[1]);
  controlsArray[idx].dragged = true;
}
function onMouseMove(ev) {
  var idx = parseInt(/c(\d+)/.exec(ev.target.getAttribute('id'))[1]);
  if(controlsArray[idx].dragged) {
    var i = controlsArray[idx].position[0];
    var j = controlsArray[idx].position[1];
    activeSample.patch[i][j] = [ev.clientX, ev.clientY];
    redraw();
  }
}
function onMouseUp(ev) {
  var idx = parseInt(/c(\d+)/.exec(ev.target.getAttribute('id'))[1]);
  controlsArray[idx].dragged = false;
}

function updateHandles() {
  for(var k=0; k<controlsArray.length; k++) {
    var i = controlsArray[k].position[0];
    var j = controlsArray[k].position[1];
    var circle = document.querySelector('#c'+k);
    var coord = activeSample.patch[i][j];
    circle.setAttribute('cx', coord[0]);
    circle.setAttribute('cy', coord[1]);
  }
}

function createGridHandles(patch) {
  var svg = document.querySelector('svg');
  var counter = 0;
  for(var i=0; i<patch.length; i++) {
    var row = patch[i];
    for(var j=0; j<row.length; j++) {
      var point = row[j];
      var circle = document.createElementNS(NS_SVG, 'circle');
      circle.setAttribute('r',5);
      circle.setAttribute('cx', point[0]);
      circle.setAttribute('cy', point[1]);
      circle.setAttribute('style', 'fill:#fff;stroke:#000;stroke-width:2;cursor:pointer');
      circle.setAttribute('id','c'+counter);
      controlsArray[counter] = {
        position : [i,j]
      };
      circle.onmousedown = onMouseDown;
      circle.onmousemove = onMouseMove;
      circle.onmouseup = onMouseUp;
      svg.appendChild(circle);
      counter++;
    }
  }
}

function createBoundaryHandles() {

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
