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
    { name: 'dpi', type: Number, defaultValue: 384},
    { name: 'resize', type: Number, defaultValue: 25},
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
const svgDir = path.dirname(options.svg);
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
    && (fs.existsSync(svgDir + '/' + options.texture) === false || fs.accessSync(svgDir + '/' + options.texture, fs.constants.R_OK) === false)
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

const textures = {};
const groups = {};

const initialization = () => new Promise(resolve => {
    const promises = [];
    const svg = fs.readFileSync(options.svg, 'utf8').replace(/\n/g, ' ');
    const items = (svg.match(/<[^/<]+?export="[^"]+?"[^>]*?>/gi) || []).map(tag => {
        let item = {
            filename: null,
            image: null,
            width: null,
            height: null
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
            item.width = image.bitmap.width;
            item.height = image.bitmap.height;
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
                    + '--pixelate=' + (item['pixelator-pixelate'] || 4) + ' '
                    + '--smooth=' + (item['pixelator-smooth'] || 1) + ' '
                    + '--enhance=' + (item['pixelator-enchance'] || '0.0') + ' '
                    + '--palette_mode=' + (item['pixelator-palletemode'] || 'adaptive') + ' '
                    + '--colors=' + (item['pixelator-colors'] || '256') + ' '
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
            [width, height] = item.extent.split('x');
            item.width = width;
            item.height = height;
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

const reloading = (items) => new Promise(resolve => {
    const promises = [];
    items.forEach(item => {
        promises.push(Jimp.read(item.filename).then(image => {
            item.image = image;
            console.log('The file: ' + item.filename + ' has been reloaded');
        }));
    });
    Promise.all(promises).then(() => {
        resolve(items);
    });
});

const shaderAnimating = (items) => new Promise(resolve => {
    const promises = [];
    items.forEach(item => {
        let frames = [];
        if ('animation' in item && item.animation === 'make-me-red') {
            frames = JimpExtra.getShaderAnimationFrames(item.image, (previous, next, x, y, idx, width, height) => {
                if (previous[idx + 3] > 0) {
                    next[idx] = 255;
                    next[idx + 1] = 0;
                    next[idx + 2] = 0;
                }
            }, item['animation-frames'] || 1);
        }
        if ('animation' in item && item.animation === 'horizontal-mirror') {
            frames = JimpExtra.getShaderAnimationFrames(item.image, (previous, next, x, y, idx, width, height) => {
                let _idx = item.image.getPixelIndex(width - x, y);
                next[idx] = previous[_idx];
                next[idx + 1] = previous[_idx + 1];
                next[idx + 2] = previous[_idx + 2];
                next[idx + 3] = previous[_idx + 3];
            }, item['animation-frames'] || 1);
        }
        if ('animation' in item && item.animation === 'bloom') {
            frames = JimpExtra.getShaderAnimationFrames(item.image, (previous, next, x, y, idx, width, height) => {
                let brightness = (0.299 * previous[idx] + 0.587 * previous[idx + 1] + 0.114 * previous[idx + 2]);
                if (brightness < (item['brightness-cutoff'] || 200)) {
                    next[idx] = 255;
                    next[idx + 1] = 255;
                    next[idx + 2] = 255;
                    next[idx + 3] = 0;
                }
            }, 1);
            promises.push(frames[0].writeAsync(options.out + '/' + item.export + '-bloom' + '.png'));
            frames = [];
        }
        for (let frameKey in frames) {
            const filename = options.out + '/' + item.export + '-anim' + frameKey + '.png';
            promises.push(frames[frameKey].writeAsync(filename));
            if ('pack' in item) {
                groups[item.pack].push(filename);
            }
        }
        if (frames.length) {
            console.log('The file: ' + item.filename + ' has been animated (' + item.animation + ')');
        }
    });
    Promise.all(promises).then(() => {
        resolve(items);
    });
});

const imagemagickAnimating = (items) => new Promise(resolve => {
    items.forEach(item => {
        const frames = item['animation-frames'] || 1;
        if ('animation' in item && item.animation === 'skew-left') {
            for (let frame = 0; frame < frames; ++frame) {
                const absoluteFilename = path.resolve(item.filename);
                const command = 'convert "' + absoluteFilename + '" '
                    + '-interpolate Nearest -filter point -background None -flip -affine 1,0,-' + ((frame + 1) * 0.05) + ',1,0,0 '
                    + '-transform -crop ' + item.width + 'x' + item.height + '+0+0 +repage -flip "' + absoluteFilename.replace('.png', '-anim' + frame + '.png') + '"';
                execSync(command);
                if ('pack' in item) {
                    groups[item.pack].push(item.filename.replace('.png', '-anim' + frame + '.png'));
                }
            }
        }
        if ('animation' in item && item.animation === 'bloom') {
            for (let frame = 0; frame < frames; ++frame) {
                const absoluteFilename = path.resolve(item.filename);
                const brightness = Math.floor((item['max-brightness'] || 25) * (frame + 1) / frames);
                const minGlow = item['min-glow'] || 25;
                const glowStep = ((item['max-glow'] || 75) - minGlow) / frames;
                const glow = minGlow + glowStep * (frames - frame - 1);
                let command = 'convert -brightness-contrast ' + brightness + 'x0 ' + absoluteFilename.replace('.png', '-bloom.png') + ' '
                    + absoluteFilename.replace('.png', '-bloom-brighten.png');
                execSync(command);
                command = 'convert ' + absoluteFilename.replace('.png', '-bloom-brighten.png') + ' '
                    + '( +clone -background ' + (item['glow-color'] || 'White') + ' -shadow 50x3+0+0 -channel A -level 0,' + glow + '% +channel ) '
                    + '-background none -compose DstOver -flatten ' + absoluteFilename.replace('.png', '-bloom-glow.png');
                execSync(command);
                command = 'composite '
                    + absoluteFilename.replace('.png', '-bloom-glow.png') + ' '
                    + absoluteFilename + ' '
                    + absoluteFilename.replace('.png', '-anim' + frame + '.png');
                execSync(command);
                if ('pack' in item) {
                    groups[item.pack].push(item.filename.replace('.png', '-anim' + frame + '.png'));
                }
            }
        }
        if ('animation' in item) {
            console.log('The file: ' + item.filename + ' has been animated (' + item.animation + ')');
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
    .then(reloading)
    .then(shaderAnimating)
    .then(imagemagickAnimating)
    .then(packing);
