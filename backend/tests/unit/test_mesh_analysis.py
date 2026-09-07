"""Pure geometric analysis: topology, metrics and self-intersection."""

from __future__ import annotations

import numpy as np
import pytest

from app.domain.geometry import analysis
from app.domain.geometry.mesh import BoundingBox, TriangleMesh
from tests.conftest import axis_aligned_box, unit_tetrahedron

EMPTY = TriangleMesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))


def _two_boxes(offset: tuple[float, float, float]) -> TriangleMesh:
    """Two 2 mm cubes in one mesh, the second shifted by ``offset``."""
    first = axis_aligned_box(2.0)
    return TriangleMesh(
        np.vstack([first.vertices, first.vertices + np.array(offset)]),
        np.vstack([first.faces, first.faces + first.vertex_count]),
    )


class TestTriangleMesh:
    def test_arrays_are_read_only(self) -> None:
        mesh = unit_tetrahedron()
        with pytest.raises(ValueError, match="read-only"):
            mesh.vertices[0, 0] = 5.0

    def test_out_of_range_face_index_is_rejected(self) -> None:
        with pytest.raises(ValueError, match="outside the vertex array"):
            TriangleMesh(np.zeros((3, 3)), np.array([[0, 1, 9]]))

    def test_non_finite_vertex_is_rejected(self) -> None:
        with pytest.raises(ValueError, match="non-finite"):
            TriangleMesh(np.array([[0.0, 0.0, np.inf]]), np.zeros((0, 3), dtype=np.int64))

    def test_wrong_shape_is_rejected(self) -> None:
        with pytest.raises(ValueError, match=r"shape \(n, 3\)"):
            TriangleMesh(np.zeros((3, 2)), np.zeros((0, 3), dtype=np.int64))

    def test_content_hash_is_stable_across_instances(self) -> None:
        assert unit_tetrahedron().content_hash() == unit_tetrahedron().content_hash()

    def test_content_hash_separates_different_geometry(self) -> None:
        assert unit_tetrahedron().content_hash() != axis_aligned_box().content_hash()


class TestBoundingBox:
    def test_extents_of_a_unit_box(self) -> None:
        box = axis_aligned_box(2.0).bounding_box
        assert box.size == (2.0, 2.0, 2.0)
        assert box.center == (1.0, 1.0, 1.0)
        assert box.diagonal == pytest.approx(2.0 * np.sqrt(3))

    def test_an_empty_point_set_collapses_to_the_origin(self) -> None:
        box = BoundingBox.from_points(np.zeros((0, 3)))
        assert box.size == (0.0, 0.0, 0.0)


class TestMetrics:
    def test_tetrahedron_volume(self) -> None:
        assert analysis.signed_volume(unit_tetrahedron()) == pytest.approx(1 / 6)

    def test_box_volume_and_area(self) -> None:
        box = axis_aligned_box(3.0)
        assert analysis.signed_volume(box) == pytest.approx(27.0)
        assert analysis.surface_area(box) == pytest.approx(54.0)

    def test_reversing_the_winding_negates_the_volume(self) -> None:
        box = axis_aligned_box()
        flipped = TriangleMesh(box.vertices, box.faces[:, ::-1])
        assert analysis.signed_volume(flipped) == pytest.approx(-analysis.signed_volume(box))

    def test_volume_scales_with_the_cube_of_size(self) -> None:
        small = analysis.signed_volume(axis_aligned_box(1.0))
        large = analysis.signed_volume(axis_aligned_box(4.0))
        assert large == pytest.approx(small * 64)

    def test_empty_mesh_has_no_volume_or_area(self) -> None:
        assert analysis.signed_volume(EMPTY) == 0.0
        assert analysis.surface_area(EMPTY) == 0.0


class TestEdgeTopology:
    def test_a_closed_solid_has_no_boundary(self) -> None:
        topology = analysis.edge_topology(axis_aligned_box())
        assert topology.is_watertight
        assert topology.is_edge_manifold
        assert topology.is_winding_consistent

    def test_removing_a_face_opens_the_surface(self) -> None:
        box = axis_aligned_box()
        open_mesh = TriangleMesh(box.vertices, box.faces[:-1])
        topology = analysis.edge_topology(open_mesh)
        assert not topology.is_watertight
        assert topology.boundary_edge_count == 3

    def test_flipping_one_face_breaks_the_winding(self) -> None:
        mesh = unit_tetrahedron()
        faces = mesh.faces.copy()
        faces[0] = faces[0][::-1]
        topology = analysis.edge_topology(TriangleMesh(mesh.vertices, faces))
        assert not topology.is_winding_consistent
        assert topology.inconsistently_wound_edge_count == 3

    def test_a_third_face_on_one_edge_is_non_manifold(self) -> None:
        mesh = unit_tetrahedron()
        extra = np.vstack([mesh.vertices, [[1.0, 1.0, 1.0]]])
        faces = np.vstack([mesh.faces, [[0, 1, 4]]])
        topology = analysis.edge_topology(TriangleMesh(extra, faces))
        assert topology.non_manifold_edge_count == 1
        assert not topology.is_edge_manifold

    def test_euler_characteristic_of_a_sphere_like_solid(self) -> None:
        box = axis_aligned_box()
        topology = analysis.edge_topology(box)
        euler = box.vertex_count - topology.unique_edge_count + box.triangle_count
        assert euler == 2


class TestDefects:
    def test_a_repeated_vertex_makes_a_face_degenerate(self) -> None:
        mesh = TriangleMesh(unit_tetrahedron().vertices, np.array([[0, 1, 1]]))
        assert analysis.degenerate_face_indices(mesh).tolist() == [0]

    def test_a_zero_area_sliver_is_degenerate(self) -> None:
        vertices = np.array([[0.0, 0, 0], [1, 0, 0], [2, 0, 0]])
        mesh = TriangleMesh(vertices, np.array([[0, 1, 2]]))
        assert analysis.degenerate_face_indices(mesh).size == 1

    def test_coincident_faces_are_reported_regardless_of_orientation(self) -> None:
        mesh = TriangleMesh(
            unit_tetrahedron().vertices, np.array([[0, 1, 2], [0, 2, 1], [1, 2, 3]])
        )
        assert analysis.duplicate_face_indices(mesh).tolist() == [0, 1]

    def test_a_clean_mesh_has_no_duplicates(self) -> None:
        assert analysis.duplicate_face_indices(axis_aligned_box()).size == 0

    def test_unreferenced_vertices_are_counted(self) -> None:
        mesh = unit_tetrahedron()
        padded = TriangleMesh(np.vstack([mesh.vertices, [[9.0, 9, 9]]]), mesh.faces)
        assert analysis.unreferenced_vertex_count(padded) == 1


class TestConnectivity:
    def test_a_single_solid_is_one_body(self) -> None:
        assert analysis.connected_component_count(axis_aligned_box()) == 1

    @pytest.mark.parametrize("copies", [2, 3, 5])
    def test_disjoint_copies_are_counted(self, copies: int) -> None:
        base = unit_tetrahedron()
        vertices = np.vstack([base.vertices + index * 10.0 for index in range(copies)])
        faces = np.vstack([base.faces + index * base.vertex_count for index in range(copies)])
        assert analysis.connected_component_count(TriangleMesh(vertices, faces)) == copies

    def test_stray_vertices_do_not_count_as_bodies(self) -> None:
        mesh = unit_tetrahedron()
        padded = TriangleMesh(np.vstack([mesh.vertices, [[9.0, 9, 9]]]), mesh.faces)
        assert analysis.connected_component_count(padded) == 1


class TestSelfIntersection:
    def test_a_clean_solid_reports_nothing(self) -> None:
        assert not analysis.find_self_intersections(axis_aligned_box()).has_intersections

    def test_two_triangles_forming_a_cross_are_detected(self) -> None:
        vertices = np.array(
            [
                [-1.0, 0, 0], [1, 0, 0], [0, 0, 1],
                [0, -1, 0.5], [0, 1, 0.5], [0, 0, -1],
            ]
        )
        result = analysis.find_self_intersections(
            TriangleMesh(vertices, np.array([[0, 1, 2], [3, 4, 5]]))
        )
        assert result.intersecting_pairs == 1
        assert result.sample == ((0, 1),)

    def test_far_apart_triangles_are_not_even_tested(self) -> None:
        vertices = np.array(
            [[0.0, 0, 0], [1, 0, 0], [0, 1, 0], [50, 50, 50], [51, 50, 50], [50, 51, 50]]
        )
        result = analysis.find_self_intersections(
            TriangleMesh(vertices, np.array([[0, 1, 2], [3, 4, 5]]))
        )
        assert (result.intersecting_pairs, result.tested_pairs) == (0, 0)

    def test_adjacent_triangles_touching_along_an_edge_are_not_intersections(self) -> None:
        vertices = np.array([[0.0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]])
        mesh = TriangleMesh(vertices, np.array([[0, 1, 2], [1, 3, 2]]))
        assert not analysis.find_self_intersections(mesh).has_intersections

    @pytest.mark.parametrize(
        "offset", [(1.0, 0.7, 0.5), (0.9, 0.9, 0.9), (1.1, 1.0, 1.0), (0.5, 0.5, 0.5)]
    )
    def test_two_interpenetrating_boxes_are_detected(
        self, offset: tuple[float, float, float]
    ) -> None:
        mesh = _two_boxes(offset)
        assert analysis.find_self_intersections(mesh).has_intersections

    def test_crossings_landing_exactly_on_a_triangulation_diagonal_are_missed(self) -> None:
        """Documents the known blind spot of a strict-interior crossing test.

        Offsetting a box by exactly half its size puts every crossing point on
        the shared diagonal of two triangles, where the barycentric margin that
        keeps adjacent faces from raising false positives also rejects the real
        hit. Any generic offset is caught, as the case above shows.
        """
        assert not analysis.find_self_intersections(
            _two_boxes((1.0, 1.0, 1.0))
        ).has_intersections

    def test_a_tiny_budget_reports_truncation_rather_than_a_clean_bill(self) -> None:
        result = analysis.find_self_intersections(
            _two_boxes((1.0, 0.7, 0.5)), max_candidate_pairs=1
        )
        assert result.truncated

    def test_a_single_triangle_cannot_self_intersect(self) -> None:
        mesh = TriangleMesh(unit_tetrahedron().vertices, np.array([[0, 1, 2]]))
        assert not analysis.find_self_intersections(mesh).has_intersections
