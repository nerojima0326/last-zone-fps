"""Convert BarcodeGames' licensed FBX without depending on its old image paths.

blender -b --python tools/guns/prepare-expansion-vector.py -- <source-dir>
Input names and hashes are recorded in expansion-sources.json.
"""
import sys
from pathlib import Path
import bpy

folder = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(folder / 'vector.fbx'), use_anim=True)
for material in bpy.data.materials:
    image = folder / (material.name + '.png')
    if not image.exists():
        continue
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Roughness'].default_value = .56
    shader.inputs['Metallic'].default_value = .35 if material.name == 'Vector_D' else 0
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = bpy.data.images.load(str(image), check_existing=True)
    material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    material.node_tree.links.new(shader.outputs['BSDF'], output.inputs['Surface'])
armature = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
reload = next(a for a in bpy.data.actions if '|Reload|' in a.name)
armature.animation_data.action = reload
bpy.context.scene.frame_set(int(reload.frame_range[0]))
bpy.ops.export_scene.gltf(
    filepath=str(folder / 'vector.glb'), export_format='GLB',
    export_animations=True, export_animation_mode='ACTIVE_ACTIONS',
    export_cameras=False, export_lights=False, export_yup=True,
    export_skins=True, export_morph=False)
