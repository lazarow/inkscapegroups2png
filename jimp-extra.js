module.exports = {
    mask(image, mask) {
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
            if (image.bitmap.data[idx + 3] > 0) {
                /**
                 * @url: https://www.w3.org/TR/compositing/#simplealphacompositing
                 */
                let maskIdx = mask.getPixelIndex(x, y);
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
