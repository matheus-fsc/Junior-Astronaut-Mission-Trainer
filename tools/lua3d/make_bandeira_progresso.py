# Generated with AI assistance (Claude). See README, "Use of AI tools".
# The little Mars flag that rides on the tip of the rocket's progress bar (HUD, tarefas/estilo.ts):
# a cloth in red and white stripes waving in a loop, toon lit with the game's navy outline, seen
# from the front. Only the cloth: the game draws the mast and hoists the cloth up it.
#
#   blender -b -P tools/lua3d/make_bandeira_progresso.py
#
# Out: public/lua/hud/bandeira_marte.png (QUADROS frames side by side, transparent)
#      src/dados/bandeira_marte.json      (frame size and the point of the cloth tied to the mast)
import bpy, bmesh, os, json, math, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'public', 'lua', 'hud', 'bandeira_marte.png')
JSON = os.path.join(ROOT, 'src', 'dados', 'bandeira_marte.json')
CACHE = os.path.join(HERE, '.cache', 'bandeira_progresso')
QUADROS = 12                       # one full wave cycle, looped
FW, FH = 96, 72                    # frame size (px); the HUD shows it about 4x smaller
LARG, ALT = 1.4, 1.0               # cloth size (Blender units)
NX, NZ = 28, 20                    # grid; 20 rows = 5 stripes of 4 rows
FAIXAS = 5
ESCALA = 1.6                       # ortho width covered by the frame (height = ESCALA * FH / FW)
CX = 0.7                           # camera centre on x


def rgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*[v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c], 1.0)


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
try:
    sc.render.engine = 'BLENDER_EEVEE'
except TypeError:
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.film_transparent = True
sc.render.resolution_x, sc.render.resolution_y = FW, FH
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'


def toon(nome, cor):
    """The colour times three hard light bands, as emission so the palette stays exact."""
    m = bpy.data.materials.new(nome); m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links; N.clear()
    dif = N.new('ShaderNodeBsdfDiffuse'); s2r = N.new('ShaderNodeShaderToRGB'); L.new(dif.outputs['BSDF'], s2r.inputs['Shader'])
    ramp = N.new('ShaderNodeValToRGB'); cr = ramp.color_ramp; cr.interpolation = 'CONSTANT'
    cr.elements[0].position = 0.0; cr.elements[0].color = (0.62, 0.62, 0.74, 1)
    cr.elements[1].position = 0.2; cr.elements[1].color = (0.85, 0.85, 0.93, 1)
    e = cr.elements.new(0.5); e.color = (1, 1, 1, 1)
    L.new(s2r.outputs['Color'], ramp.inputs['Fac'])
    mul = N.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
    mul.inputs[6].default_value = rgb(cor); L.new(ramp.outputs['Color'], mul.inputs[7])
    em = N.new('ShaderNodeEmission'); L.new(mul.outputs[2], em.inputs['Color'])
    out = N.new('ShaderNodeOutputMaterial'); L.new(em.outputs[0], out.inputs['Surface'])
    m.use_backface_culling = False
    return m


vermelho, branco = toon('vermelho', '#ef4444'), toon('branco', '#f8fafc')

# The navy outline is added around the silhouette after the render (a flat cloth seen from the
# front has no inverse-hull rim). The cloth: a grid in the x-z plane (camera on -y), the mast edge at x = 0, top at z = ALT / 2.
me = bpy.data.meshes.new('pano'); bm = bmesh.new()
vs = [[bm.verts.new((LARG * i / NX, 0, ALT / 2 - ALT * j / NZ)) for i in range(NX + 1)] for j in range(NZ + 1)]
for j in range(NZ):
    for i in range(NX):
        f = bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
        f.material_index = (j * FAIXAS // NZ) % 2
bm.to_mesh(me); bm.free()
pano = bpy.data.objects.new('pano', me); sc.collection.objects.link(pano)
for m in (vermelho, branco): me.materials.append(m)
base = [v.co.copy() for v in me.vertices]

cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = ESCALA
cam_o = bpy.data.objects.new('cam', cam); sc.collection.objects.link(cam_o); sc.camera = cam_o
cam_o.location = (CX, -5, 0); cam_o.rotation_euler = (math.radians(90), 0, 0)
luz = bpy.data.lights.new('luz', 'SUN'); luz.energy = 3.0
luz_o = bpy.data.objects.new('luz', luz); sc.collection.objects.link(luz_o)
luz_o.rotation_euler = (math.radians(60), math.radians(-20), math.radians(-35))


def ondular(t):
    """Wave travelling away from the mast, growing toward the free edge; the tip droops a bit."""
    for v, b in zip(me.vertices, base):
        u = b.x / LARG
        fase = 2 * math.pi * (1.3 * u - t)
        v.co.x = b.x - 0.04 * u * (1 - math.cos(fase))
        v.co.y = 0.24 * u * math.sin(fase)
        v.co.z = b.z - 0.05 * u * u + 0.03 * u * math.sin(fase + 0.8)
    me.update()


os.makedirs(CACHE, exist_ok=True); os.makedirs(os.path.dirname(OUT), exist_ok=True)
arquivos = []
for f in range(QUADROS):
    ondular(f / QUADROS)
    sc.render.filepath = os.path.join(CACHE, f'q{f:02d}.png')
    bpy.ops.render.render(write_still=True)
    arquivos.append(sc.render.filepath)

# The point of the cloth tied to the top of the mast, in frame pixels.
alto_vista = ESCALA * FH / FW
ancora = [round((0 - (CX - ESCALA / 2)) / ESCALA * FW, 2), round((alto_vista / 2 - ALT / 2) / alto_vista * FH, 2)]
monta = r'''
import sys
from PIL import Image, ImageFilter
sai, fw, fh, *ents = sys.argv[1:]
fw, fh = int(fw), int(fh)
folha = Image.new('RGBA', (fw * len(ents), fh), (0, 0, 0, 0))
for k, e in enumerate(ents):
    im = Image.open(e).convert('RGBA')
    borda = im.getchannel('A').point(lambda v: 255 if v > 30 else 0).filter(ImageFilter.MaxFilter(7))
    q = Image.new('RGBA', im.size, (0, 0, 0, 0))
    q.paste(Image.new('RGBA', im.size, (11, 26, 74, 255)), (0, 0), borda)
    q.alpha_composite(im)
    folha.paste(q, (k * fw, 0))
folha.save(sai, optimize=True)
'''
subprocess.run(['python3', '-c', monta, OUT, str(FW), str(FH), *arquivos], check=True)
with open(JSON, 'w') as fp:
    json.dump({'arquivo': 'lua/hud/bandeira_marte.png', 'quadros': QUADROS, 'w': FW, 'h': FH, 'ancora': ancora,
               'alturaPano': round(ALT / alto_vista * FH, 2)}, fp, indent=2)
    fp.write('\n')
print('DONE', OUT, ancora)
