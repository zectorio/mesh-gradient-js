
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
      var dx = parseInt(coord[0]);
      var dy = parseInt(coord[1]);
      coons.push([cursor[0]+dx, cursor[1]+dy]);
      if(i === 3) {
        cursor[0] += dx;
        cursor[1] += dy;
      }
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

  coons.pop(); // The first point gets added twice, because it's a closed loop

  return {coons:coons,colors:colors};
}

function getMeshGradientAABB(patchData) {
  var xmin = Infinity;
  var xmax = -Infinity;
  var ymin = Infinity;
  var ymax = -Infinity;

  for(var i=0; i<patchData.length; i++) {
    var data = patchData[i];
    for(var j=0; j<data.coons.length; j++) {
      var point = data.coons[j];
      xmin = Math.min(xmin, point[0]);
      xmax = Math.max(xmax, point[0]);
      ymin = Math.min(ymin, point[1]);
      ymax = Math.max(ymax, point[1]);
    }
  }

  return {xmin:xmin, ymin:ymin, xmax:xmax, ymax:ymax};
}

function meshGradToImg(patchData, mgx, mgy) {
  var aabb = getMeshGradientAABB(patchData);
  var width = aabb.xmax-aabb.xmin;
  var height = aabb.ymax-aabb.ymin;

  var canvas = document.createElementNS('http://www.w3.org/1999/xhtml','canvas');
  canvas.width = width;
  canvas.height = height;
  var ctx = canvas.getContext('2d');
  var imgdata = ctx.getImageData(0,0,width,height);

  for(var i=0; i<patchData.length; i++) {
    var data = patchData[i];
    draw_bezier_patch(
      imgdata.data, width,height,
      interpolateCoons(data.coons), data.colors);
  }

  ctx.putImageData(imgdata, 0,0);
  var img = document.createElementNS('http://www.w3.org/2000/svg','image');
  img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', canvas.toDataURL());
  img.setAttribute('x', mgx);
  img.setAttribute('y', mgy);
  img.setAttribute('width',''+width);
  img.setAttribute('height',''+height);
  return img;
}

function searchForMeshGrads(node, callback) {

  var style = node.getAttribute('style');
  if(style) {
    var pairs = style.split(';');
    for(var j=0; j<pairs.length; j++) {
      var pair = pairs[j];
      var value = pair.split(':')[1];
      var result = /url\(#(meshGradient\d+)\)/.exec(value);
      if(result && result.length > 1) {
        callback(node, result[1]);
      }
    }
  }

  for(var i=0; i<node.children.length; i++) {
    var child = node.children[i];
    searchForMeshGrads(child, callback);
  }
}

function replaceElements(mgmap) {
  var keys = Object.keys(mgmap);
  searchForMeshGrads(svg, function (elem, mgid) {
    if(keys.indexOf(mgid) >= 0) {
      svg.insertBefore(mgmap[mgid], elem);
      svg.removeChild(elem);
    }
  });
}


function run() {
  var meshGradMap = {};
  var patchData = [];
  var meshGradients = document.querySelectorAll('meshGradient');
  for(var i=0; i<meshGradients.length; i++) {
    var mg = meshGradients[i];
    var mgid = mg.getAttribute('id');
    var mgx = mg.getAttribute('x');
    var mgy = mg.getAttribute('y');
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
          patchData.push(data);
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
  var img = meshGradToImg(patchData, mgx, mgy);
  meshGradMap[mgid] = img;

  replaceElements(meshGradMap);
}

run();

