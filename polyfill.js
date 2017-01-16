
var svg = document.querySelector('svg');

function color_css2rgb(css) {
  css = css.toLowerCase();

  if (!css.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)) {
    return;
  }

  css = css.replace(/^#/,'');

  var bytes = css.length/3;
  var max = Math.pow(16, bytes) - 1;
  return [
    Math.round(255 * parseInt(css.slice(0, bytes), 16) / max),
    Math.round(255 * parseInt(css.slice(bytes * 1,bytes * 2), 16) / max),
    Math.round(255 * parseInt(css.slice(bytes * 2), 16) / max)
  ];
}

function stopsToCoons(stops) {
  var cursor = [0,0];
  var coons = [];
  coons.push(cursor.slice(0));
  var colors = [];

  for(var si=0; si<stops.length; si++) {
    var stop = stops[si];

    var path = stop.getAttribute('path').split(/\s+/);
    console.assert(path.length === 4);
    for(var i=1; i<4; i++) {
      var coord = path[i].split(',');
      cursor[0] += parseInt(coord[0]);
      cursor[1] += parseInt(coord[1]);
      coons.push(cursor.slice(0));
    }

    var pairs = stop.getAttribute('style').split(';');
    var stopColor='#000000', stopOpacity=1;
    for(var pi=0; pi<pairs.length; pi++) {
      var pair = pairs[pi].split(':');
      if(pair[0] === 'stop-color') {
        stopColor = pair[1];
      } else if(pair[0] === 'stop-opacity') {
        stopOpacity = parseInt(pair[1]);
      }
    }
    var rgba = color_css2rgb(stopColor);
    rgba[3] = Math.round(255 * stopOpacity);
    colors.push(rgba);
  }

  coons.pop(); // The first point gets added twice, as it's a closed loop

  return {coons:coons,colors:colors};
}

var canvas = document.createElementNS('http://www.w3.org/1999/xhtml','canvas');
canvas.width = svg.clientWidth;
canvas.height = svg.clientHeight;
var ctx = canvas.getContext('2d');
var imgdata = ctx.getImageData(0,0,svg.clientWidth,svg.clientHeight);


var meshGradients = document.querySelectorAll('meshGradient');
for(var i=0; i<meshGradients.length; i++) {
  var mg = meshGradients[i];
  var rows = mg.querySelectorAll('meshRow');
  for(var j=0; j<rows.length; j++) {
    var row = rows[j];
    var patches = row.querySelectorAll('meshPatch');
    for(var k=0; k<patches.length; k++) {
      var patch = patches[k];
      var stops = patch.querySelectorAll('stop');
      if(j === 0 && k === 0) {
        console.assert(stops.length === 4);
        var data = stopsToCoons(stops);
        draw_bezier_patch(
          imgdata.data, svg.clientWidth,svg.clientHeight, interpolateCoons(data.coons), data.colors);
      } else if(j === 0 && k !== 0) {
        console.assert(stops.length === 2);
      } else if(j !== 0 && k === 0) {
        console.assert(stops.length === 2);
      } else if(j !== 0 && k !== 0) {
        console.assert(stops.length === 1);
      }
    }
  }
}

ctx.putImageData(imgdata, 0,0);
var img = document.createElementNS('http://www.w3.org/2000/svg','image');
img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', canvas.toDataURL());
img.setAttribute('x','0');
img.setAttribute('y','0');
img.setAttribute('width',''+svg.clientWidth);
img.setAttribute('height',''+svg.clientHeight);
svg.appendChild(img);
