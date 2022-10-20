
/**
 * http://www.java2s.com/example/nodejs/html/convert-canvas-to-data-url.html
 */
/*
const toDataURL = function (canvas: any) {
    var imageData = Array.prototype.slice.call(canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data);
    var w = canvas.width;
    var h = canvas.height;
    var stream = [
   0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
   0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
  ];//from w  w w.j  a va 2  s .c om
    Array.prototype.push.apply(stream, w.bytes32());
    Array.prototype.push.apply(stream, h.bytes32());
    stream.push(0x08, 0x06, 0x00, 0x00, 0x00);
    Array.prototype.push.apply(stream, stream.crc32(12, 17).bytes32());
    var len = h * (w * 4 + 1);
    for (var y = 0; y < h; y++)
        imageData.splice(y * (w * 4 + 1), 0, 0);
    var blocks = Math.ceil(len / 32768);
    Array.prototype.push.apply(stream, (len + 5 * blocks + 6).bytes32());
    var crcStart = stream.length;
    var crcLen = (len + 5 * blocks + 6 + 4);
    stream.push(0x49, 0x44, 0x41, 0x54, 0x78, 0x01);
    for (var i = 0; i < blocks; i++) {
        var blockLen = Math.min(32768, len - (i * 32768));
        stream.push(i == (blocks - 1) ? 0x01 : 0x00);
        Array.prototype.push.apply(stream, blockLen.bytes16sw());
        Array.prototype.push.apply(stream, (~blockLen).bytes16sw());
        var id = imageData.slice(i * 32768, i * 32768 + blockLen);
        Array.prototype.push.apply(stream, id);
    }
    Array.prototype.push.apply(stream, imageData.adler32().bytes32());
    Array.prototype.push.apply(stream, stream.crc32(crcStart, crcLen).bytes32());

    stream.push(0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44);
    Array.prototype.push.apply(stream, stream.crc32(stream.length - 4, 4).bytes32());
    return "data:image/png;base64," + btoa(stream.map(function (c) {
        return String.fromCharCode(c);
    }).join(''));
};
*/
