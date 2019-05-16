module.exports = {
    mask(image, mask) {
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
            let hasAlpha = image.bitmap.data[idx + 3] > 0;
            let isWhite = image.bitmap.data[idx] === 255 && image.bitmap.data[idx + 1] === 255 && image.bitmap.data[idx + 2] === 255;
            if (hasAlpha && ! isWhite) {
                /**
                 * @url: https://www.w3.org/TR/compositing/#simplealphacompositing
                 */
                let maskIdx = mask.getPixelIndex(x % mask.bitmap.width, y % mask.bitmap.height);
                let as = mask.bitmap.data[maskIdx + 3] / 255;
                let ab = image.bitmap.data[idx + 3] / 255;
                for (let i of [0, 1, 2]) {
                    let Cb = image.bitmap.data[idx + i] / 255;
                    let Cs = mask.bitmap.data[maskIdx + i] / 255;
                    image.bitmap.data[idx + i] = Math.floor((Cs * as + Cb * ab * (1 - as)) * 255);
                }
                image.bitmap.data[idx + 3] = Math.floor((as + ab * (1 - as)) * 255);
            }
        });
    }
};
