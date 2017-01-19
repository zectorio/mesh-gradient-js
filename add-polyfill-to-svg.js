
var fs = require('fs');
var readline = require('readline');

if(process.argv.length < 3) {
  console.error('Missing input SVG');
  process.exit(1);
}

var insvg = process.argv[2];
var isDev = process.argv[3] === 'dev';

var javascript;
if(isDev) {
  console.info('Dev build');
  javascript =
    fs.readFileSync('mesh-gradient.js').toString()+'\n'+
    fs.readFileSync('polyfill.js').toString()+'\n';
} else {
  console.info('Prod build');
  javascript = fs.readFileSync('build/polyfill.min.js').toString();
}

var polyfill =
  '<script type="application/ecmascript"> <![CDATA['+javascript+']]> </script>';

var outname = 'out.svg';
console.info('Output SVG file:', outname);

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

