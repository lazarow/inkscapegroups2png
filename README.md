# InkscapeGroups2PNG

Generates PNG files from Inkscape's SVG files. The script identifies object to export based on prefixes, that should be added in the Inkscape's XML editor.
It uses Inkspace's command line options to export objects that have IDs with provided prefixes. The objects that have the same prefix will be pack as a single texture file.
Beware! The output directory is everytime cleaned at the beginning.

## Information
...
The tool uses [gamefroot-texture-packer](https://github.com/Gamefroot/Gamefroot-Texture-Packer) for creating atlas textures and [jimp](https://www.npmjs.com/package/jimp) for filtering (some postprocessing).

## Installation
1. Install [Inkscape](https://inkscape.org/).
1. Install [ImageMagick](http://www.imagemagick.org/), on Ubuntu, I've just type the standard command: `sudo apt install imagemagick`, on the other hand, on Windows, I've installed the version _ImageMagick-6.9.10-45-Q8-x64-dll_ from [this FTP](ftp://ftp.imagemagick.org/pub/ImageMagick/binaries/), the newer version doesn't have the program called `identify`.
1. Install dependencies through `npm install`.

## Usage

```
node index.js --inkscape "C:\Program Files\Inkscape\inkscape.exe" --svg test.svg --out test --prefixes gg
```

