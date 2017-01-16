
var fs = require('fs');
var readline = require('readline');

if(process.argv.length < 3) {
  console.error('Missing input SVG');
  process.exit(1);
}

var insvg = process.argv[2];

var polyfill =
  '<script type="application/ecmascript"> <![CDATA['+
  fs.readFileSync('mesh-gradient.js').toString()+'\n'+
  fs.readFileSync('polyfill.js').toString()+'\n'+
  ']]> </script>';

var outname = process.argv[3] ? process.argv[3] : 'out.svg';

var rl = readline.createInterface({
  input : fs.createReadStream(insvg)
});
fs.writeFileSync(outname, '', {flag:'w'});

rl.on('line', function (line) {
  if(line.trim() === '</svg>') {
    fs.writeFileSync(outname, polyfill+'\n', {flag:'a'});
  }
  fs.writeFileSync(outname, line+'\n', {flag:'a'});
});

