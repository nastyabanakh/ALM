import sharp from 'sharp';
import { CmsError } from './store.mjs';

// Parse ISO-BMFF box boundaries, not just the ftyp marker. Require actual
// video sample metadata and media data; the browser still reports codec errors.
function validateMP4(bytes) {
  let boxes = 0, hasVideo = false, hasData = false, hasType = false;
  const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'moof', 'traf']);
  function walk(start, end, depth = 0) {
    if (depth > 12) throw new Error('Invalid MP4 nesting');
    let offset = start;
    while (offset < end) {
      if (++boxes > 100000 || offset + 8 > end) throw new Error('Invalid MP4 box');
      let size = bytes.readUInt32BE(offset), header = 8;
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      if (size === 1) {
        if (offset + 16 > end) throw new Error('Invalid MP4 size');
        const large = bytes.readBigUInt64BE(offset + 8);
        if (large > BigInt(bytes.length)) throw new Error('Invalid MP4 size');
        size = Number(large); header = 16;
      } else if (!size) size = end - offset;
      if (size < header || offset + size > end) throw new Error('Truncated MP4');
      const body = offset + header;
      if (depth === 0 && type === 'ftyp' && size >= header + 8) hasType = true;
      if (depth === 0 && type === 'mdat' && size > header) hasData = true;
      if (type === 'stsd' && size >= header + 16) {
        const count = bytes.readUInt32BE(body + 4);
        let sample = body + 8;
        for (let i = 0; i < count; i++) {
          if (sample + 8 > offset + size) throw new Error('Invalid video sample');
          const length = bytes.readUInt32BE(sample), codec = bytes.toString('ascii', sample + 4, sample + 8);
          if (length < 8 || sample + length > offset + size) throw new Error('Invalid video sample');
          if (['avc1', 'avc3', 'hvc1', 'hev1', 'vp09', 'av01', 'mp4v'].includes(codec) && length >= 86) hasVideo = true;
          sample += length;
        }
      }
      if (containers.has(type)) walk(body, offset + size, depth + 1);
      offset += size;
    }
  }
  walk(0, bytes.length);
  if (!hasType || !hasVideo || !hasData) throw new Error('MP4 has no playable video track');
}
export async function validateMediaBytes(bytes, expected) {
  const kind = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
    : bytes[0] === 255 && bytes[1] === 216 ? 'jpg'
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'webp'
    : bytes.toString('ascii', 4, 8) === 'ftyp' ? 'mp4' : null;
  if (!kind || expected && expected.replace(/^\./, '').replace('jpeg', 'jpg').toLowerCase() !== kind) throw new CmsError(415, 'File format does not match the selected media');
  try {
    if (kind === 'mp4') validateMP4(bytes);
    else await sharp(bytes, { failOn: 'warning', limitInputPixels: 40000000 }).resize(1, 1, { fit: 'inside' }).raw().toBuffer();
  } catch { throw new CmsError(415, kind === 'mp4' ? 'This video is damaged or has no supported video track.' : 'This image is damaged or too large to decode.'); }
  return kind;
}
