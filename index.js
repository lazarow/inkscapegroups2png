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
    { name: 'dpi', type: Number, defaultValue: 192},
    { name: 'resize', type: Number, defaultValue: 100},
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

// <editor-fold desc="Helpers" defaultstate="collapsed">
String.prototype.matchAll = function (regexp) {
    let matches = [];
    this.replace(regexp, function () {
        let arr = ([]).slice.call(arguments, 0);
        let extras = arr.splice(-2);
        arr.index = extras[0];
        arr.input = extras[1];
        matches.push(arr);
    });
    return matches.length ? matches : null;
};
// </editor-fold>

const svgDir = path.dirname(options.svg);
const textures = {};
const groups = {};

const initialization = () => new Promise(resolve => {
    const promises = [];
    const svg = fs.readFileSync(options.svg, 'utf8').replace(/\n/g, ' ');
    const items = (svg.match(/<[^/<]+?export="[^"]+?"[^>]*?>/gi) || []).map(tag => {
        let item = {
            filename: null,
            image: null
        };
        for (let match of tag.matchAll(/([a-zA-Z0-9\-]+?)="([^"]+?)"/gi)) {
            item[match[1]] = match[2];
            if (match[1] === 'texture' && match[2] !== 'false') {
                promises.push(Jimp.read(svgDir + '/' + match[2]).then(image => (textures[match[2]] = image)));
            }
        }
        return item;
    });
    if ('texture' in options) {
        promises.push(Jimp.read(svgDir + '/' + options.texture).then(image => (textures.texture = image)));
    }
    Promise.all(promises).then(() => {
        resolve(items);
    });
});

const generating = (items) => new Promise(resolve => {
    const promises = [];
    items.map(item => {
        const command = '"' + options.inkscape + '" --export-id=' + item.id + ' --export-dpi=' + options.dpi
            + ' --export-id-only --export-png=' + options.out + '/' + item.export + '.png ' + options.svg;
        execSync(command);
        console.log('The element ' + item.export + ' has been exported');
        promises.push(Jimp.read(options.out + '/' + item.export + '.png').then(image => {
            item.filename = options.out + '/' + item.export + '.png';
            if ('pack' in item) {
                if (item.pack in groups === false) {
                    groups[item.pack] = [];
                }
                groups[item.pack].push(item.filename);
            }
            item.image = image;
        }));
        return item;
    });
    Promise.all(promises).then(() => {
        resolve(items);
    });
});

const addingTextures = (items) => new Promise(resolve => {
    const promises = [];
    items.forEach(item => {
        if ('texture' in item) {
            JimpExtra.mask(item.image, textures[item.texture]);
        } else if ('texture' in options ) {
            JimpExtra.mask(item.image, textures['texture']);
        }
        console.log('The file: ' + item.filename + ' has been textured');
        promises.push(item.image.writeAsync(item.filename));
    });
    Promise.all(promises).then(() => {
        resolve(items);
    });
});

const pixelating = (items) => new Promise(resolve => {
    if ('pixelator' in options) {
        const pixelatorDir = path.dirname(options.pixelator);
        items.forEach(item => {
            if (item['pixelator'] !== 'false') {
                const absoluteFilename = path.resolve(item.filename);
                const command = 'cd "' + pixelatorDir + '" && "' + options.pixelator + '" '
                    + '--pixelate=' + (item['pixelator-pixelate'] || 3) + ' '
                    + '--smooth=' + (item['pixelator-smooth'] || 1) + ' '
                    + '--enhance=' + (item['pixelator-enchance'] || '0.0') + ' '
                    + '--palette_mode=' + (item['pixelator-palletemode'] || 'file') + ' '
                    + '--override '
                    + '--stroke=' + (item['pixelator-stroke'] || 'none') + ' '
                    + '"'
                    + absoluteFilename + '" "' + absoluteFilename + '"';
                execSync(command);
                console.log('The file: ' + item.filename + ' has been pixelated');
            }
        });
    }
    resolve(items);
});

const resizing = (items) => new Promise(resolve => {
    if (options.resize !== 100) {
        items.forEach(item => {
            const absoluteFilename = path.resolve(item.filename);
            const command = 'convert "' + absoluteFilename + '" '
                + '-interpolate Nearest -filter point -resize ' + options.resize + '% '
                + '"' + absoluteFilename + '"';
            execSync(command);
            console.log('The file: ' + item.filename + ' has been resized');
        });
    }
    resolve(items);
});

const extending = (items) => new Promise(resolve => {
    items.forEach(item => {
        if ('extent' in item && 'gravity' in item) {
            const absoluteFilename = path.resolve(item.filename);
            const command = 'convert "' + absoluteFilename + '" '
                + '-background None -gravity ' + item.gravity + ' -extent ' + item.extent + ' '
                + '"' + absoluteFilename + '"';
            execSync(command);
            console.log('The file: ' + item.filename + ' has been extented');
        }
    });
    resolve(items);
});

const blurring = (items) => new Promise(resolve => {
    items.forEach(item => {
        if ('blur' in item) {
            const absoluteFilename = path.resolve(item.filename);
            const command = 'convert "' + absoluteFilename + '" '
                + '-blur ' + item.blur + ' '
                + '"' + absoluteFilename + '"';
            execSync(command);
            console.log('The file: ' + item.filename + ' has been blurred');
        }
    });
    resolve(items);
});

const packing = () => new Promise(resolve => {
    for (let name in groups) {
        packer(groups[name], {
            format: 'json',
            name: name,
            path: options.out
        }, function (err) {
            if (err) console.log(err);
        });
    }
    resolve();
});

initialization()
    .then(generating)
    .then(addingTextures)
    .then(pixelating)
    .then(resizing)
    .then(extending)
    .then(blurring)
    .then(packing);
