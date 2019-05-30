module.exports = {
    mask(image, mask, texturedColor, opacityFactor) {
        if (texturedColor !== undefined) {
            texturedColor = texturedColor.split(',');
        }
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
            let hasAlpha = image.bitmap.data[idx + 3] > 0;
            let isWhite = image.bitmap.data[idx] === 255 && image.bitmap.data[idx + 1] === 255 && image.bitmap.data[idx + 2] === 255;
            let isTexturedColor = typeof texturedColor === 'undefined'
                ? true
                : (
                    image.bitmap.data[idx] == texturedColor[0]
                    && image.bitmap.data[idx + 1] == texturedColor[1]
                    && image.bitmap.data[idx + 2] == texturedColor[2]
                );
            if (hasAlpha && ! isWhite && isTexturedColor) {
                /**
                 * @url: https://www.w3.org/TR/compositing/#simplealphacompositing
                 */
                let maskIdx = mask.getPixelIndex(x % mask.bitmap.width, y % mask.bitmap.height);
                let as = mask.bitmap.data[maskIdx + 3] / 255 / opacityFactor;
                let ab = image.bitmap.data[idx + 3] / 255;
                for (let i of [0, 1, 2]) {
                    let Cb = image.bitmap.data[idx + i] / 255;
                    let Cs = mask.bitmap.data[maskIdx + i] / 255;
                    image.bitmap.data[idx + i] = Math.floor((Cs * as + Cb * ab * (1 - as)) * 255);
                }
                image.bitmap.data[idx + 3] = Math.floor((as + ab * (1 - as)) * 255);
            }
        });
    },
    getShaderAnimationFrames(image, pixelShader, nofFrames = 3) {
        const frames = [];
        const next = image.clone();
        while (nofFrames--) {
            const previous = next.clone();
            next.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
                pixelShader(
                    previous.bitmap.data,
                    next.bitmap.data,
                    x,
                    y,
                    idx,
                    image.bitmap.width,
                    image.bitmap.height
                );
            });
            frames.push(next.clone());
        }
        return frames;
    }
};
