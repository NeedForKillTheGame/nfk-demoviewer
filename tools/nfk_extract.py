#!/usr/bin/env python3
# Extracts the original graphics of NFK 0.77 for the demo viewer (only the python standard library is used).
#
#   python3 tools/nfk_extract.py <basenfk> images/nfk          # the images the viewer uses + all player models
#   python3 tools/nfk_extract.py --all <basenfk> <dir>          # every image of graph.d and graph2.d, for a look
#
# <basenfk> is the folder of the original game data (system/graph.d, system/graph2.d, models/).
#
# graph.d / graph2.d are PowerDraw VTD archives: header 'VTDB', a table of 64-byte records
# (key string[31], format, position, CRC, size, original size), every record is a 64-byte header + zlib data.
# A record is an AGF image: 'AGFX', texture width/height, pattern width/height, texture count, BGRA pixels.
# Patterns (frames) go by rows inside a texture, like TAGFImage.SetPatternEx() does.
#
# A player model is a folder with *.nmdl skins (ini files). NFK loads every bitmap of a skin as a strip
# of patterns (SC_LoadModels): walk = modelsizex x 48, die = 52 x diesizey, crouch = crouchsizex x crouchsizey,
# the power bitmaps have the walk/crouch pattern sizes. A TGA keeps its alpha, a BMP is loaded as A1R5G5B5
# with one transparent colour: white for the body, black for the powerup shell (Set1bitAlpha).
# Every model is written as <model>.png with all the strips one under another and models.json with the
# skin parameters and the place of every strip.

import os, sys, struct, zlib, json

# images of the archives used by the viewer: output name -> (archive, record key)
IMAGES = {
	'explosion': ('graph.d', 'explosion'),
	'smoke32b': ('graph.d', 'smoke32b'),
	'16x16': ('graph2.d', '16x16'),
	'8x8': ('graph2.d', '8x8'),
	'burn_med_mrk': ('graph2.d', 'burn_med_mrk'),
	'bullet_mrk': ('graph2.d', 'bullet_mrk'),
	'railtrace1': ('graph2.d', 'railtrace1'),
	'railhit': ('graph2.d', 'railhit'),
	'shaft': ('graph2.d', 'shaft'),
	'gibs': ('graph2.d', 'gibs'),
	'weapons': ('graph2.d', 'weapons'),
	'mgun_ex': ('graph2.d', 'mgun_ex'),
	'gauntlet': ('graph2.d', 'gauntlet'),
}

# ---------------------------------------------------------------------------------------------------------------
# PNG

def png_bytes(w, h, rows):
	# rows of RGBA bytes, no filtering: the sprites are mostly transparent and compress well anyway
	raw = b''.join(b'\x00' + r for r in rows)
	def chunk(t, b):
		return struct.pack('>I', len(b)) + t + b + struct.pack('>I', zlib.crc32(t + b) & 0xffffffff)
	return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
		+ chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

class Image:
	def __init__(self, w, h, rows=None):
		self.w, self.h = w, h
		self.rows = rows if rows is not None else [bytearray(w * 4) for _ in range(h)]

	def crop(self, x, y, w, h):
		img = Image(w, h)
		for j in range(h):
			if 0 <= y + j < self.h:
				src = self.rows[y + j]
				x1, x2 = max(x, 0), min(x + w, self.w)
				if x2 > x1:
					img.rows[j][(x1 - x) * 4:(x2 - x) * 4] = src[x1 * 4:x2 * 4]
		return img

	def paste(self, img, x, y):
		for j in range(img.h):
			self.rows[y + j][x * 4:(x + img.w) * 4] = img.rows[j]

	def save(self, path):
		with open(path, 'wb') as f:
			f.write(png_bytes(self.w, self.h, [bytes(r) for r in self.rows]))

# ---------------------------------------------------------------------------------------------------------------
# VTD / AGF

def read_vtd(path):
	d = open(path, 'rb').read()
	sig, ver, cover, count, tablepos = struct.unpack('<IffiI', d[:20])
	if sig != 0x42445456: # VTDB
		raise ValueError(path + ': not a VTD archive')
	images = {}
	for i in range(count):
		o = tablepos + i * 64
		key = d[o + 1:o + 1 + d[o]].decode('latin1').lower()
		fmt, pos, crc, size, orig = struct.unpack('<iiIii', d[o + 32:o + 52])
		data = zlib.decompress(d[pos + 64:pos + size]) # the CRC is pdrawCRC32, it is not checked
		if len(data) != orig:
			raise ValueError(path + ': bad record ' + key)
		images[key] = read_agf(data)
	return images

def read_agf(data):
	sig, tw, th, pw, ph, count = struct.unpack('<6i', data[:24])
	if sig != 0x58464741:
		raise ValueError('not an AGF image')
	pw, ph = pw or tw, ph or th
	textures = []
	pos = 24
	for t in range(count):
		rows = []
		for y in range(th):
			line = bytearray(data[pos:pos + tw * 4])
			pos += tw * 4
			line[0::4], line[2::4] = line[2::4], line[0::4] # BGRA -> RGBA
			rows.append(line)
		textures.append(Image(tw, th, rows))
	if count == 1:
		return textures[0], (pw, ph)
	# several textures: the patterns go one under another in a single image
	per = (tw // pw) * (th // ph)
	img = Image(pw, ph * per * count)
	for n in range(per * count):
		tex = textures[n // per]
		k = n % per
		img.paste(tex.crop(k % (tw // pw) * pw, k // (tw // pw) * ph, pw, ph), 0, n * ph)
	return img, (pw, ph)

# ---------------------------------------------------------------------------------------------------------------
# TGA / BMP

def read_tga(path):
	d = open(path, 'rb').read()
	idlen, cmtype, typ = d[0], d[1], d[2]
	cmlen, cmbits = struct.unpack('<H', d[5:7])[0], d[7]
	w, h, bpp, desc = struct.unpack('<HHBB', d[12:18])
	if cmtype or typ not in (2, 10) or bpp not in (24, 32):
		raise ValueError(path + ': unsupported TGA')
	n = bpp // 8
	pos = 18 + idlen
	px = bytearray()
	if typ == 2:
		px = bytearray(d[pos:pos + w * h * n])
	else:
		while len(px) < w * h * n:
			c = d[pos]
			pos += 1
			if c & 0x80:
				px += d[pos:pos + n] * ((c & 0x7F) + 1)
				pos += n
			else:
				px += d[pos:pos + n * (c + 1)]
				pos += n * (c + 1)
	rows = []
	for y in range(h):
		src = px[y * w * n:(y + 1) * w * n]
		row = bytearray(w * 4)
		row[0::4], row[1::4], row[2::4] = src[2::n], src[1::n], src[0::n]
		# the 4th byte is the alpha even when the header declares no alpha bits
		row[3::4] = src[3::n] if n == 4 else b'\xff' * w
		rows.append(row)
	if not desc & 0x20: # bottom-up
		rows.reverse()
	return Image(w, h, rows)

def read_bmp(path, transparent):
	d = open(path, 'rb').read()
	if d[:2] != b'BM':
		raise ValueError(path + ': not a BMP')
	off = struct.unpack('<I', d[10:14])[0]
	hsize, w, h, planes, bpp, comp = struct.unpack('<IiiHHI', d[14:34])
	if comp not in (0, 3):
		raise ValueError(path + ': compressed BMP')
	colors = struct.unpack('<I', d[46:50])[0] or (1 << bpp if bpp <= 8 else 0)
	palette = [d[14 + hsize + i * 4:14 + hsize + i * 4 + 3] for i in range(colors)]
	stride = (w * bpp + 31) // 32 * 4
	rows = []
	for y in range(abs(h)):
		line = d[off + y * stride:off + (y + 1) * stride]
		row = bytearray(w * 4)
		for x in range(w):
			if bpp <= 8:
				bit = x * bpp
				idx = (line[bit // 8] >> (8 - bpp - bit % 8)) & ((1 << bpp) - 1)
				b, g, r = palette[idx]
			else:
				b, g, r = line[x * bpp // 8:x * bpp // 8 + 3]
			# A1R5G5B5 texture: 5 bits per colour, the colour key loses the alpha bit
			r, g, b = (r >> 3, g >> 3, b >> 3)
			a = 0 if (r, g, b) == transparent else 255
			row[x * 4:x * 4 + 4] = bytes((r << 3 | r >> 2, g << 3 | g >> 2, b << 3 | b >> 2, a))
		rows.append(row)
	if h > 0:
		rows.reverse()
	return Image(w, abs(h), rows)

def read_model_bitmap(path, power):
	if path.lower().endswith('.tga'):
		return read_tga(path)
	return read_bmp(path, (0, 0, 0) if power else (31, 31, 31))

# ---------------------------------------------------------------------------------------------------------------
# models

def read_ini(path):
	values = {}
	for line in open(path, 'rb').read().decode('latin1').splitlines():
		line = line.strip()
		if '=' in line and not line.startswith(';'):
			k, v = line.split('=', 1)
			values[k.strip().lower()] = v.strip()
	return values

def find_file(folder, name):
	# file names in the nmdl are case insensitive (Windows)
	for f in os.listdir(folder):
		if f.lower() == name.lower():
			return os.path.join(folder, f)
	return None

def extract_model(folder):
	strips = [] # (file, image, pattern width, pattern height)
	skins = {}
	for nmdl in sorted(f for f in os.listdir(folder) if f.lower().endswith('.nmdl')):
		ini = read_ini(os.path.join(folder, nmdl))
		if ini.get('version') != '2':
			continue
		files = {k: find_file(folder, ini.get(k + 'bmp', '')) for k in ('walk', 'die', 'crouch', 'walkpower')}
		files['crouchpower'] = find_file(folder, ini.get('crouchpowerupbmp', ''))
		if not all(files.values()):
			print('  skipped ' + nmdl + ': no bitmap')
			continue
		num = lambda k: int(ini[k])
		skin = {k: num(k) for k in ('walkframes', 'walkstartframe', 'modelsizex', 'framerefreshtime', 'dieframes',
			'diesizey', 'crouchsizex', 'crouchframes', 'crouchsizey', 'crouchrefreshtime', 'crouchstartframe')}
		for k in ('modelsizex', 'diesizey', 'crouchsizex', 'crouchsizey'):
			skin[k] = min(skin[k], 96)
		skin['dieframerefreshtime'] = num('dieframerefreshtime') if ini.get('dieframerefreshtime') else skin['framerefreshtime']
		if skin['framerefreshtime'] < 1 or skin['framerefreshtime'] >= 20:
			skin['framerefreshtime'] = 5
		sizes = {
			'walk': (skin['modelsizex'], 48), 'walkpower': (skin['modelsizex'], 48), 'die': (52, skin['diesizey']),
			'crouch': (skin['crouchsizex'], skin['crouchsizey']), 'crouchpower': (skin['crouchsizex'], skin['crouchsizey'])
		}
		for kind, path in files.items():
			pw, ph = sizes[kind]
			key = (path.lower(), pw, ph)
			found = [i for i, s in enumerate(strips) if s[0] == key]
			if not found:
				img = read_model_bitmap(path, kind.endswith('power'))
				strips.append((key, img, pw, ph))
				found = [len(strips) - 1]
			skin[kind] = found[0]
		skins[ini.get('name', nmdl[:-5]).lower()] = skin
	if not skins:
		return None, None
	# all strips one under another, a strip keeps the layout of its bitmap (patterns go by rows)
	width = max(s[1].w for s in strips)
	sheet = Image(width, sum(s[1].h for s in strips))
	places = []
	y = 0
	for key, img, pw, ph in strips:
		sheet.paste(img, 0, y)
		places.append([0, y, img.w, img.h])
		y += img.h
	for skin in skins.values():
		for kind in ('walk', 'die', 'crouch', 'walkpower', 'crouchpower'):
			skin[kind] = places[skin[kind]]
	return sheet, skins

# ---------------------------------------------------------------------------------------------------------------

def main(args):
	dump_all = '--all' in args
	args = [a for a in args if a != '--all']
	if len(args) != 2:
		print('usage: nfk_extract.py [--all] <basenfk> <output dir>')
		return 1
	base, out = args
	os.makedirs(out, exist_ok=True)
	system = find_file(base, 'system')
	archives = {name: read_vtd(find_file(system, name)) for name in ('graph.d', 'graph2.d')}

	if dump_all:
		meta = {}
		for name, images in archives.items():
			folder = os.path.join(out, name.split('.')[0])
			os.makedirs(folder, exist_ok=True)
			for key, (img, pattern) in images.items():
				img.save(os.path.join(folder, key + '.png'))
				meta[name + ':' + key] = dict(size=[img.w, img.h], pattern=list(pattern))
		json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'), indent=1)
		print('%d images' % len(meta))
		return 0

	for name, (archive, key) in IMAGES.items():
		img, pattern = archives[archive][key]
		img.save(os.path.join(out, name + '.png'))
		print('%-14s %4dx%-4d pattern %dx%d' % (name, img.w, img.h, pattern[0], pattern[1]))

	models_dir = os.path.join(out, 'models')
	os.makedirs(models_dir, exist_ok=True)
	models = {}
	src = find_file(base, 'models')
	for model in sorted(os.listdir(src)):
		folder = os.path.join(src, model)
		if not os.path.isdir(folder):
			continue
		sheet, skins = extract_model(folder)
		if not sheet:
			continue
		model = model.lower()
		sheet.save(os.path.join(models_dir, model + '.png'))
		models[model] = skins
		print('model %-10s %4dx%-4d skins: %s' % (model, sheet.w, sheet.h, ', '.join(skins)))
	with open(os.path.join(models_dir, 'models.json'), 'w') as f:
		json.dump(models, f, indent='\t', sort_keys=True)
	return 0

if __name__ == '__main__':
	sys.exit(main(sys.argv[1:]))
