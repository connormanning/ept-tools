# ept tile

Translate an Entwine Point Tile dataset to [3D Tiles](https://github.com/AnalyticalGraphicsInc/3d-tiles) on disk.  See [`ept serve`](serve.md) for on-the-fly tileset generation.

```bash
ept tile --help
```

# Usage

```bash
ept tile <ept-root>/ept.json
```

This command creates a [3D Tiles tileset](https://github.com/AnalyticalGraphicsInc/3d-tiles/tree/master/specification) in `<ept-root>/ept-tileset/`.

# Quickstart

Follow the steps from the Entwine [quickstart](https://entwine.io/quickstart.html) to build a small EPT dataset at `~/entwine/red-rocks`:
```bash
conda create -n entwine -c conda-forge entwine
conda activate entwine
entwine build -i https://data.entwine.io/red-rocks.laz -o ~/entwine/red-rocks
```

Then translate the data:
```bash
ept tile ~/entwine/red-rocks/ept.json
```

A 3D Tiles tileset is created: `~/entwine/red-rocks/ept-tileset/tileset.json`.  To statically serve:
```bash
npm install http-server -g
http-server ~/entwine -p 3030 --cors
```

And to view: http://cesium.entwine.io?url=http://localhost:3030/red-rocks/ept-tileset/tileset.json

# Notes

- Only EPT data with UTM spatial references codes are currently supported (a more robust set of SRS codes could be added).

