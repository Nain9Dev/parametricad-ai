import cadquery as cq
from app.domain.ports.cad_port import CadPort
from app.domain.models.cad_request import ComponentParams
import os

class CadqueryAdapter(CadPort):
    def generate_glb(self, params: ComponentParams, output_path: str) -> bool:
        try:
            diameter = params.diameter if params.diameter else 10.0
            radius = diameter / 2.0
            thickness = radius * 0.1
            inner_radius = radius - thickness
            
            result_shape = None
            
            if params.type == "pipe":
                length = params.length if params.length else 100.0
                result_shape = (
                    cq.Workplane("XY")
                    .circle(radius)
                    .circle(inner_radius)
                    .extrude(length)
                )
            elif params.type == "elbow":
                angle = params.angle if params.angle else 90.0
                # Simplified elbow sweep
                path = cq.Workplane("XZ").moveTo(radius*2, 0).radiusArc((0, radius*2), angle)
                result_shape = (
                    cq.Workplane("XY")
                    .circle(radius)
                    .circle(inner_radius)
                    .sweep(path)
                )
            elif params.type == "flange":
                result_shape = (
                    cq.Workplane("XY")
                    .circle(radius * 2)
                    .extrude(thickness * 2)
                    .faces(">Z").workplane()
                    .circle(inner_radius).cutThruAll()
                )
            else:
                result_shape = cq.Workplane("XY").box(diameter, diameter, diameter).faces(">Z").hole(inner_radius * 2)
            
            if result_shape:
                # Export to STL first
                stl_path = output_path.replace('.glb', '.stl')
                cq.exporters.export(result_shape, stl_path, 'STL')
                
                # Convert to GLB using trimesh
                import trimesh
                mesh = trimesh.load(stl_path)
                mesh.export(output_path)
                
                # Clean up STL
                if os.path.exists(stl_path):
                    os.remove(stl_path)
                    
                return True
                
            return False
        except Exception as e:
            print(f"Error generating CAD: {e}")
            return False
