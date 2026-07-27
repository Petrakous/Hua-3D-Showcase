"""Build a lightweight, continuous collision/occlusion proxy in headless Blender.

Run through Blender, not the system Python:

    blender --background --factory-startup --python scripts/build_collision_proxy_blender.py -- \
      --input source.glb --output proxy.glb --voxel-size 0.5 --target-faces 80000

The script never overwrites an existing output unless --overwrite is supplied.
It writes a JSON report next to the output even when a processing stage fails.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
import traceback
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--voxel-size", type=float, default=0.5)
    parser.add_argument("--target-faces", type=int, default=80_000)
    parser.add_argument("--merge-distance", type=float, default=0.001)
    parser.add_argument("--adaptivity", type=float, default=0.0)
    parser.add_argument("--max-dense-voxels", type=int, default=25_000_000)
    parser.add_argument("--inspect-only", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args(argv)


def stage(report: dict, name: str, callback):
    print(f"\n=== {name} ===", flush=True)
    started = time.perf_counter()
    result = callback()
    elapsed = time.perf_counter() - started
    report.setdefault("timings_seconds", {})[name] = round(elapsed, 3)
    print(f"{name}: {elapsed:.2f}s", flush=True)
    return result


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path: Path) -> list[bpy.types.Object]:
    result = bpy.ops.import_scene.gltf(filepath=str(path))
    if "FINISHED" not in result:
        raise RuntimeError(f"Blender failed to import {path}: {result}")
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No mesh objects were imported from {path}")
    return meshes


def join_meshes(meshes: list[bpy.types.Object]) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        result = bpy.ops.object.join()
        if "FINISHED" not in result:
            raise RuntimeError(f"Could not join imported meshes: {result}")
    obj = bpy.context.view_layer.objects.active
    obj.name = "HUA_CollisionProxy"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def clean_mesh(obj: bpy.types.Object, merge_distance: float) -> None:
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    if merge_distance > 0:
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=merge_distance)
        bmesh.ops.dissolve_degenerate(
            bm,
            edges=list(bm.edges),
            dist=merge_distance,
        )
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

    mesh.materials.clear()
    for uv_layer in list(mesh.uv_layers):
        mesh.uv_layers.remove(uv_layer)
    if hasattr(mesh, "color_attributes"):
        for attribute in list(mesh.color_attributes):
            mesh.color_attributes.remove(attribute)


def world_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector(
        (
            min(point.x for point in corners),
            min(point.y for point in corners),
            min(point.z for point in corners),
        )
    )
    maximum = Vector(
        (
            max(point.x for point in corners),
            max(point.y for point in corners),
            max(point.z for point in corners),
        )
    )
    return minimum, maximum


def mesh_stats(obj: bpy.types.Object, include_topology: bool = False) -> dict:
    mesh = obj.data
    mesh.calc_loop_triangles()
    minimum, maximum = world_bounds(obj)
    dimensions = maximum - minimum
    stats = {
        "vertices": len(mesh.vertices),
        "edges": len(mesh.edges),
        "polygons": len(mesh.polygons),
        "triangles": len(mesh.loop_triangles),
        "bounds_min": [round(value, 6) for value in minimum],
        "bounds_max": [round(value, 6) for value in maximum],
        "dimensions": [round(value, 6) for value in dimensions],
    }
    if include_topology:
        bm = bmesh.new()
        bm.from_mesh(mesh)
        boundary_edges = sum(1 for edge in bm.edges if len(edge.link_faces) == 1)
        non_manifold_edges = sum(1 for edge in bm.edges if not edge.is_manifold)
        stats["boundary_edges"] = boundary_edges
        stats["non_manifold_edges"] = non_manifold_edges
        stats["manifold"] = non_manifold_edges == 0
        bm.free()
    return stats


def estimate_dense_grid_voxels(stats: dict, voxel_size: float) -> int:
    dimensions = stats["dimensions"]
    return math.prod(max(1, math.ceil(float(value) / voxel_size)) for value in dimensions)


def voxel_remesh(obj: bpy.types.Object, voxel_size: float, adaptivity: float) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    mesh = obj.data
    mesh.remesh_mode = "VOXEL"
    mesh.remesh_voxel_size = voxel_size
    mesh.remesh_voxel_adaptivity = adaptivity
    if hasattr(mesh, "use_remesh_preserve_volume"):
        mesh.use_remesh_preserve_volume = True
    result = bpy.ops.object.voxel_remesh()
    if "FINISHED" not in result:
        raise RuntimeError(f"Voxel remesh failed: {result}")


def decimate(obj: bpy.types.Object, target_faces: int) -> None:
    current_faces = len(obj.data.polygons)
    if current_faces <= target_faces:
        print(
            f"Skipping decimation: {current_faces:,} polygons already <= {target_faces:,}.",
            flush=True,
        )
        return
    modifier = obj.modifiers.new(name="HUA_TargetFaceDecimate", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = max(0.0001, min(1.0, target_faces / current_faces))
    modifier.use_collapse_triangulate = True
    result = bpy.ops.object.modifier_apply(modifier=modifier.name)
    if "FINISHED" not in result:
        raise RuntimeError(f"Decimation failed: {result}")


def triangulate(obj: bpy.types.Object) -> None:
    modifier = obj.modifiers.new(name="HUA_Triangulate", type="TRIANGULATE")
    result = bpy.ops.object.modifier_apply(modifier=modifier.name)
    if "FINISHED" not in result:
        raise RuntimeError(f"Triangulation failed: {result}")


def export_glb(obj: bpy.types.Object, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    result = bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_materials="NONE",
    )
    if "FINISHED" not in result:
        raise RuntimeError(f"GLB export failed: {result}")


def write_report(path: Path, report: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2), encoding="utf-8")


def main() -> int:
    args = parse_args()
    input_path = args.input.resolve()
    output_path = args.output.resolve()
    report_path = (args.report or output_path.with_suffix(".report.json")).resolve()
    report = {
        "status": "running",
        "blender_version": bpy.app.version_string,
        "input": str(input_path),
        "output": str(output_path),
        "settings": {
            "voxel_size": args.voxel_size,
            "target_faces": args.target_faces,
            "merge_distance": args.merge_distance,
            "adaptivity": args.adaptivity,
            "max_dense_voxels": args.max_dense_voxels,
            "inspect_only": args.inspect_only,
        },
        "timings_seconds": {},
    }
    overall_started = time.perf_counter()

    try:
        if not input_path.is_file():
            raise FileNotFoundError(f"Input GLB does not exist: {input_path}")
        if args.voxel_size <= 0:
            raise ValueError("--voxel-size must be greater than zero")
        if args.target_faces < 1:
            raise ValueError("--target-faces must be positive")
        if output_path.exists() and not args.overwrite and not args.inspect_only:
            raise FileExistsError(
                f"Output already exists: {output_path}. Use --overwrite explicitly."
            )

        stage(report, "reset_scene", reset_scene)
        meshes = stage(report, "import_glb", lambda: import_glb(input_path))
        obj = stage(report, "join_and_apply_transforms", lambda: join_meshes(meshes))
        stage(report, "clean_input", lambda: clean_mesh(obj, args.merge_distance))
        report["input_stats"] = mesh_stats(obj, include_topology=True)
        dense_voxels = estimate_dense_grid_voxels(
            report["input_stats"],
            args.voxel_size,
        )
        report["estimated_dense_grid_voxels"] = dense_voxels
        print(json.dumps(report["input_stats"], indent=2), flush=True)
        print(f"Estimated dense grid: {dense_voxels:,} voxels", flush=True)

        if args.inspect_only:
            report["status"] = "inspected"
            return 0
        if dense_voxels > args.max_dense_voxels:
            raise RuntimeError(
                f"Safety stop: estimated dense grid {dense_voxels:,} exceeds "
                f"--max-dense-voxels {args.max_dense_voxels:,}. Increase voxel size "
                "or raise the limit only after reviewing the report."
            )

        stage(
            report,
            "voxel_remesh",
            lambda: voxel_remesh(obj, args.voxel_size, args.adaptivity),
        )
        report["remeshed_stats"] = mesh_stats(obj, include_topology=False)
        stage(report, "decimate", lambda: decimate(obj, args.target_faces))
        stage(report, "triangulate", lambda: triangulate(obj))
        stage(report, "final_cleanup", lambda: clean_mesh(obj, args.merge_distance))
        report["output_stats"] = mesh_stats(obj, include_topology=True)
        stage(report, "export_glb", lambda: export_glb(obj, output_path))
        report["output_bytes"] = output_path.stat().st_size
        report["status"] = "completed"
        print(json.dumps(report["output_stats"], indent=2), flush=True)
        print(f"Output: {output_path}", flush=True)
        return 0
    except Exception as error:
        report["status"] = "failed"
        report["error"] = str(error)
        report["traceback"] = traceback.format_exc()
        print(report["traceback"], file=sys.stderr, flush=True)
        return 1
    finally:
        report["timings_seconds"]["total"] = round(
            time.perf_counter() - overall_started,
            3,
        )
        write_report(report_path, report)
        print(f"Report: {report_path}", flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
