# InkscapeGroups2PNG

InkscapeGroups2PNG is a **command-line tool** that supports my efforts in being a visual artist for a small gamejam project.
Once upon the time, my co-workers and I have decided to take a part in the gamejam [**Jamingtons 7**](https://itch.io/jam/jamingtons7).
We've split the roles among us and I've received the role of a 2D visual artist (xD,LoL,...), to be more precise, 
the one and only graphic designer in the team.

I've spent a great amount of time figuring out how to create tons of assets with minimal effort. I must say: 
I'm newbie and I still don't have a clue how pros do it, BUT after watching a lot of stuff on YouTube, 
I've started getting an idea how to deal with my problem.

In broad strokes, I know Inkscape so this is my first and only choice of painting software. My idea is automation all processes 
except creating assets in Inkscape. As you know, Inkscape works on the custom SVG format, yet it's still a plain XML.

Inkscape has a build-in XML editor, so it's fairy easy to add additional meta-data to shapes, groups and other elements.
Those meta-data in form of a tag's attributes will control the process of generating assets directly from a SVG file. 

Well, this is exactly what this tool does. It takes a SVG file and generates PNG files,
which are preprocessed by variety of external tools and libraries. The process is controlled by the command-line arguments and 
defined XML attributes.

## Installation (what you need to install)
1. Install [Inkscape](https://inkscape.org/) of course.
1. Install [ImageMagick](http://www.imagemagick.org/), on Ubuntu, I've just type the standard command: `sudo apt install imagemagick`, 
on the other hand, on Windows, I've installed the version _ImageMagick-6.9.10-45-Q8-x64-dll_ from [this FTP](ftp://ftp.imagemagick.org/pub/ImageMagick/binaries/), 
the newer version doesn't have the program called `identify`. Be sure, if this tool is avaiable from the terminal. 
1. Install dependencies through `npm install`.

## Command-line usage
```
node index.js [Optional options]... --inkscape {path to Inkscape executable} --svg {the input svg file} --out {the output dir path}
Optional options:
    --texture {texture path}            Adds texture to all images
    --resize {resize in percent}        Resises all images
    --dpi {dpi}                         Sets the DPI for image exporting from Inkscape
    --pixelator {pixelator executable}  The path to the Pixelator executable
```

## Tools features

The tool provides several postprocessing tools and effects. The very first is exporting to PNG files.
You need to **add the attribute `export` to an element in Inkscape XML editor** in order to export it. 
The value of the attribute will be a filename and it will identify the element in later postprocessing, that's why it need to be unique.

### Texture packer
Add the attribute `pack` to create a packed texture. All assets that have the same `pack` attribute will be packed 
by [gamefroot-texture-packer](https://github.com/Gamefroot/Gamefroot-Texture-Packer) to an atlas texture (png + json).

## SVG attributes

## Examples

```
node index.js --inkscape "C:\Program Files\Inkscape\inkscape.exe" --svg test.svg --out test --prefixes gg
```

