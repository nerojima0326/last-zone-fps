// Basis Universal 1.16.3 npm binary (encoder reports v1.15). Keep JPEG fallbacks.
// NODE_PATH=<sharp> BASISU=/path/to/basisu node tools/optimize/build-gpu-textures.cjs
const fs = require('fs'), path = require('path'), cp = require('child_process'), sharp = require('sharp');
const root = path.resolve(__dirname, '../..'), dir = path.join(root, 'assets/tex');
(async () => {
  if (!process.env.BASISU) throw Error('Set BASISU to the encoder executable');
  const manifest = { version: 1, encoder: 'basisu npm 1.16.3', textures: {} };
  let original = 0, packed = 0;
  for (const folder of fs.readdirSync(dir).sort()) {
    const base = path.join(dir, folder); if (!fs.statSync(base).isDirectory() || folder === 'gpu') continue;
    for (const name of fs.readdirSync(base).filter(n => /_(diff|nor_gl|arm)_1k\.jpg$/.test(n)).sort()) {
      const input = path.join(base, name), rel = folder + '/' + name, output = path.join(dir, 'gpu', rel.replace(/\.jpg$/, '.ktx2'));
      fs.mkdirSync(path.dirname(output), { recursive: true });
      const normal = name.includes('_nor_gl_'), linear = normal || name.includes('_arm_');
      const args = ['-file', input, '-output_file', output, '-ktx2', '-mipmap', '-y_flip', '-no_alpha', '-no_multithreading'];
      if (normal) args.push('-uastc', '-uastc_level', '2', '-normal_map', '-mip_renorm');
      else args.push('-q', '200', ...(linear ? ['-linear'] : []));
      if (!fs.existsSync(output)) cp.execFileSync(process.env.BASISU, args, { stdio: 'pipe' });
      const md = await sharp(input).metadata();
      const rgb = await sharp(input).resize(16, 16, { fit: 'fill' }).removeAlpha().raw().toBuffer();
      const mean = [0, 0, 0];
      for (let i = 0; i < rgb.length; i++) { const c = rgb[i] / 255; mean[i % 3] += (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4) / 256; }
      const bytes = fs.statSync(output).size;
      manifest.textures[rel] = { file: 'gpu/' + rel.replace(/\.jpg$/, '.ktx2'), width: md.width, height: md.height, mean, bytes, mode: normal ? 'UASTC' : 'ETC1S', colorSpace: linear ? 'linear' : 'sRGB' };
      original += fs.statSync(input).size; packed += bytes;
      console.log(rel, bytes);
    }
  }
  manifest.downloadBytes = { jpeg: original, ktx2: packed };
  fs.writeFileSync(path.join(dir, 'gpu/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('JPEG / KTX2 bytes:', original, packed);
})().catch(e => { console.error(e); process.exit(1); });
