// Geometry-only Node fixtures. Browser regression checks decode the real images.
// Reuse the game's attachment mapping, cloning and eye-height metadata.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

export async function loadAttachmentFixtures(T, G, root) {
  const uri = file => pathToFileURL(path.join(process.env.THREE_DIR, file)).href;
  const { GLTFLoader } = await import(uri('examples/jsm/loaders/GLTFLoader.js'));
  const { MeshoptDecoder } = await import(uri('examples/jsm/libs/meshopt_decoder.module.js'));
  const { mergeGeometries } = await import(uri('examples/jsm/utils/BufferGeometryUtils.js'));
  class LocalGLTFLoader extends GLTFLoader {
    constructor() {
      super();
      this.setMeshoptDecoder(MeshoptDecoder);
      this.register(parser => ({
        name: 'NodeGeometryOnlyTextures',
        beforeRoot() {
          const texture = () => Promise.resolve(new T.Texture());
          parser.loadTexture = texture;
          for (const plugin of Object.values(parser.plugins)) {
            if (plugin.loadTexture) plugin.loadTexture = texture;
          }
        }
      }));
    }
    async loadAsync(url) {
      const bytes = fs.readFileSync(path.join(root, url.split('?')[0]));
      return this.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    }
  }
  window.G = G;
  window.THREE = { ...T, GLTFLoader: LocalGLTFLoader, MeshoptDecoder, mergeGeometries };
  G.WEAPONS ||= {ar7:{key:'ar7',cls:'rifle'},g18:{key:'g18',cls:'pistol'}};
  for(const file of ['attachment-models','attachment-mounts'])vm.runInThisContext(fs.readFileSync(path.join(root,'js/'+file+'.js'),'utf8'),{filename:'js/'+file+'.js'});
  vm.runInThisContext(fs.readFileSync(path.join(root, 'js/attachments.js'), 'utf8'), { filename: 'js/attachments.js' });
  await G.Attachments.load();
  for (const id of ['micro', 'reddot', 'holo', 'x2', 'x4', 'x8', 'grip', 'suppressor', 'brake', 'laser', 'choke']) {
    if (!G.Attachments.models[id]) throw Error('Attachment fixture failed to load: ' + id);
  }
  return LocalGLTFLoader;
}
