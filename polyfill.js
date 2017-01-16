
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

function stopsToPatch(stops) {
    for(var si=0; si<stops.length; si++) {
      var stop = stops[si];
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
      var rgb = color_css2rgb(stopColor);
      rgb[3] = Math.round(255 * stopOpacity);
      console.log(rgb);
    }

}

var canvas = document.createElementNS('http://www.w3.org/1999/xhtml','canvas');
canvas.width = 256; // svg.clientWidth;
canvas.height = 256; //svg.clientHeight;
var ctx = canvas.getContext('2d');
ctx.clearRect(0,0,256,256);
ctx.fillStyle = '#0f0';
ctx.fillRect(0,0,150,150);
ctx.fillStyle = '#ff0';
ctx.fillRect(20,20,150,150);
var imgdata = ctx.getImageData(0,0,256,256);

var img = document.createElementNS('http://www.w3.org/2000/svg','image');
img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', canvas.toDataURL());
img.setAttribute('x','0');
img.setAttribute('y','0');
img.setAttribute('width','256');
img.setAttribute('height','256');
svg.appendChild(img);

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
        stopsToPatch(stops);
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
