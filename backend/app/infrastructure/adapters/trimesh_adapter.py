from app.domain.ports.simulation_port import SimulationPort
import trimesh
import os

class TrimeshAdapter(SimulationPort):
    def validate_mesh(self, file_path: str) -> dict:
        if not os.path.exists(file_path):
            return {"is_valid": False, "error": "File not found"}
            
        try:
            # Trimesh can load GLB/GLTF
            mesh = trimesh.load(file_path, force='mesh')
            
            is_watertight = mesh.is_watertight
            volume = mesh.volume
            bounding_box = mesh.bounds.tolist()
            
            # Collision/intersection is usually done between multiple meshes (CollisionManager),
            # but for a single generated component we check if it is valid (watertight).
            
            return {
                "is_valid": True,
                "is_watertight": is_watertight,
                "volume": float(volume),
                "bounding_box": bounding_box
            }
        except Exception as e:
            return {"is_valid": False, "error": str(e)}
