"""
make_collision.py
-----------------
Load one GLB or merge all GLB tiles from a MipMap output folder into a single
lightweight collision mesh (no textures, decimated) and export as collision.glb.

Usage:
    python make_collision.py <glb_or_tiles_folder> <output_glb> [ratio]

Example:
    python make_collision.py "../../GLBs/classroom-5_tiles" "../Scenes/Classroom 5/collision.glb"

Pipeline step: run this once after MipMap reconstruction, before editor calibration.
Target: ~60k faces — good enough for FP collision, small enough for the web (~2-5 MB).
"""

import sys
import pathlib
import numpy as np
import trimesh

DEFAULT_RATIO = 0.80


def load_meshes(source: pathlib.Path) -> tuple[list[trimesh.Trimesh], int]:
    glb_files = [source] if source.is_file() else sorted(source.glob("*.glb"))
    if not glb_files:
        raise FileNotFoundError(f"No .glb files found at {source}")

    meshes = []
    total_before = 0

    for glb_path in glb_files:
        scene = trimesh.load(str(glb_path), force="scene", process=False)
        for geom in scene.geometry.values():
            if isinstance(geom, trimesh.Trimesh) and len(geom.faces) > 0:
                if len(geom.vertices) > 1 and int(geom.faces.max()) == 0:
                    raise ValueError(
                        f"{glb_path} uses compressed indices that trimesh could not decode. "
                        "Decompress/dequantize the GLB before building collision geometry."
                    )
                # Strip textures — keep geometry only
                geom.visual = trimesh.visual.ColorVisuals()
                meshes.append(geom)
                total_before += len(geom.faces)
        print(f"  loaded {glb_path.name}")

    print(f"  total faces before merge: {total_before:,}")
    return meshes, total_before


def make_collision(source_path: str, output_path: str, ratio: float = DEFAULT_RATIO) -> None:
    source = pathlib.Path(source_path)
    out = pathlib.Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    print(f"Loading geometry from: {source}")
    meshes, total_faces = load_meshes(source)

    print("Merging meshes...")
    merged = trimesh.util.concatenate(meshes)
    print(f"  merged: {len(merged.faces):,} faces, {len(merged.vertices):,} vertices")

    # Decimate purely by ratio
    n_faces = len(merged.faces)
    target = int(n_faces * ratio)
    
    print(f"Decimating to ~{target:,} faces ({ratio*100:.1f}% of original)...")
    simplified = merged.simplify_quadric_decimation(face_count=target)
    print(f"  result: {len(simplified.faces):,} faces, {len(simplified.vertices):,} vertices")

    # Export as GLB (no materials/textures)
    simplified.visual = trimesh.visual.ColorVisuals()
    glb_bytes = trimesh.exchange.gltf.export_glb(simplified)
    out.write_bytes(glb_bytes)

    size_mb = out.stat().st_size / 1_048_576
    print(f"Exported: {out}  ({size_mb:.2f} MB)")


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        print("Usage: python make_collision.py <glb_or_tiles_folder> <output_glb> [ratio]")
        sys.exit(1)

    ratio = DEFAULT_RATIO
    if len(sys.argv) == 4:
        try:
            ratio = float(sys.argv[3])
            if not (0.0 < ratio <= 1.0):
                raise ValueError()
        except ValueError:
            print("Error: ratio must be a float between 0.0 and 1.0 (e.g. 0.80 for 80%).")
            sys.exit(1)

    make_collision(sys.argv[1], sys.argv[2], ratio)
