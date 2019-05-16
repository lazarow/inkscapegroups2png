// <editor-fold desc="Includes" defaultstate="collapsed">
const commandLineArgs = require('command-line-args');
const executable = require('executable');
const fs = require('fs');
const { execSync } = require('child_process');
const packer = require('gamefroot-texture-packer');
const fsExtra = require('fs-extra');
const Jimp = require('jimp');
const JimpExtra = require('./jimp-extra.js');
const path = require('path');
// </editor-fold>

const options = commandLineArgs([
    { name: 'inkscape', defaultValue: '/usr/bin/inkscape'},
    { name: 'svg', defaultValue: ''},
    { name: 'out', defaultValue: ''},
    { name: 'dpi', type: Number, defaultValue: 72},
    { name: 'prefixes', multiple: true, defaultValue: [] },
    { name: 'texture' },
    { name: 'pixelator' }
]);

// <editor-fold desc="Command options validation" defaultstate="collapsed">
if (
    fs.existsSync(options.inkscape) === false
    || executable.sync(options.inkscape) === false
) {
    console.error('Inkscape seems to be not executable, maybe the path is invalid?');
    process.exit();
}
if (
    fs.existsSync(options.svg) === false
    || fs.accessSync(options.svg, fs.constants.R_OK) === false
) {
    console.error('The input SVG seems to be not readable, maybe the path is invalid?');
    process.exit();
}
if (
    fs.existsSync(options.out) === false
    && fs.mkdirSync(options.out, { recursive: true }) === false
) {
    console.error('The output directory cannot be created');
    process.exit();
}
if (fs.accessSync(options.out, fs.constants.W_OK) === false) {
    console.error('The output directory seems to be not writable?');
    process.exit();
}
fsExtra.emptyDirSync(options.out);
if (
    'texture' in options
    && (fs.existsSync(options.texture) === false || fs.accessSync(options.texture, fs.constants.R_OK) === false)
) {
    console.error('The mask texture seems to be not readable, maybe the path is invalid?');
    process.exit();
}
if (
    'pixelator' in options
    && (fs.existsSync(options.pixelator) === false || executable.sync(options.pixelator) === false)
) {
    console.error('Pixelator seems to be not executable, maybe the path is invalid?');
    process.exit();
}
// </editor-fold>

let texture = null;

const initialization = () => new Promise(resolve => {
    const promises = [];
    if ('texture' in options) {
        promises.push(Jimp.read(options.texture).then(image => (texture = image)));
    }
    Promise.all(promises).then(() => {
        resolve();
    });
});

const generating = () => new Promise(resolve => {
    const promises = [];
    const images = [];
    const svg = fs.readFileSync(options.svg, 'utf8');
    options.prefixes.forEach(prefix => {
        svg.match(new RegExp(prefix + '[^\\s\\\\"\']+', 'g')).forEach(id => {
            const command = '"' + options.inkscape + '" --export-id=' + id + ' --export-dpi=' + options.dpi
                + ' --export-id-only --export-png=' + options.out + '/' + id + '.png ' + options.svg;
            execSync(command);
            promises.push(Jimp.read(options.out + '/' + id + '.png').then(image => {
                image.filename = options.out + '/' + id + '.png';
                images.push(image);
            }));
            console.log('The object ' + id + '.png has been exported');
        });
    });
    Promise.all(promises).then(() => {
        resolve(images);
    });
});

const postgenerating = (images) => new Promise(resolve => {
    const promises = [];
    const imagesFilenames = [];
    for (let image of images) {
        if (texture !== null) {
            JimpExtra.mask(image, texture);
        }
        promises.push(image.writeAsync(image.filename));
        imagesFilenames.push(image.filename);
    }
    Promise.all(promises).then(() => {
        if ('pixelator' in options) {
            const pixelatorDir = path.dirname(options.pixelator);
            imagesFilenames.forEach(filename => {
                const absoluteFilename = path.resolve(filename);
                const command = 'cd "' + pixelatorDir + '" && "' + options.pixelator + '" --override --stroke=none "'
                    + absoluteFilename + '" "' + absoluteFilename + '"';
                execSync(command);
                console.log('The file: ' + filename + ' has been pixelated');
            });
        }
        resolve();
    });
});

const completion = () => new Promise(resolve => {
    options.prefixes.forEach(prefix => {
        packer(options.out + '/' + prefix + '*.png', {
            format: 'json',
            name: prefix,
            path: options.out
        }, function (err) {
            if (err) console.log(err);
        });
    });
    resolve();
});

initialization()
    .then(generating)
    .then(postgenerating)
    .then(completion);