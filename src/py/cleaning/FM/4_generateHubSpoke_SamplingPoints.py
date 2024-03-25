import geojson
from shapely.geometry import Point, LineString, mapping, Polygon
import rasterio
from tqdm import tqdm

# Path to the Digital Elevation Model (DEM) file
dem_path = 'src/assets/data/internal/usgs/usgs150m_wgs84/usgs150mWGS84.tif' 

geojson.geometry.DEFAULT_PRECISION = 3

print("sampling points ...")

def sample_points_on_line(line, num_points, outward=False):
    """
    Adjusted to generate points that extend the line in the opposite direction,
    effectively doubling the 'radius' for outward points.
    """
    points = []
    if num_points > 0:
        # The distance between each point
        point_spacing = line.length / num_points
        
        # Calculate the vector of the line
        line_start = Point(line.coords[0])
        line_end = Point(line.coords[-1])
        vector_x = line_end.x - line_start.x
        vector_y = line_end.y - line_start.y
        
        for i in range(1, num_points + 1):
            if outward:
                # For outward points, we start at the line's start and go in the opposite direction
                new_x = line_start.x - vector_x * (i / num_points)
                new_y = line_start.y - vector_y * (i / num_points)
            else:
                # For inward points, we interpolate along the line
                new_x = line_start.x + vector_x * (i / num_points)
                new_y = line_start.y + vector_y * (i / num_points)
            
            point = Point(new_x, new_y)
            points.append(point)

    return points


def add_elevation(point, raster, band_array):
    """
    Get elevation for a point from a preloaded raster band array. Unchanged.
    """
    row, col = raster.index(point.x, point.y)
    elevation = band_array[row, col]
    if elevation == raster.nodata:
        return None
    else:
        return round(float(elevation), 2)
    
def generate_spokes_with_sampling(input_geojson, output_geojson, transmitter_output_geojson, dem_path=None, sampling_resolution=4):
    print("generating ...")
    
    with open(input_geojson, 'r') as file:
        data = geojson.load(file)
    
    raster = rasterio.open(dem_path) if dem_path else None
    band_array = raster.read(1) if dem_path else None

    output = {"type": "FeatureCollection", "features": []}
    transmitter_sites_output = {"type": "FeatureCollection", "features": []}
    transmitter_sites_added = set()

    total_vertices = sum(len(feature['geometry']['coordinates'][0]) for feature in data['features'])
    total_iterations = total_vertices * (sampling_resolution + 1)  # +1 for the vertex itself

    progress_bar = tqdm(total=total_iterations, desc="Processing Vertices")


    for feature in data['features']:
        transmitter_location = feature['properties']['transmitter_site'].split(', ')
        transmitter_point = Point(float(transmitter_location[0]), float(transmitter_location[1]))
        transmitter_key = f"{transmitter_location[0]},{transmitter_location[1]}"
        lms_application_id = feature['properties']['lms_application_id']

        # print(f"processing transmitter {transmitter_key}...")

        if transmitter_key not in transmitter_sites_added:
            transmitter_elevation = add_elevation(transmitter_point, raster, band_array) if raster else None
            transmitter_sites_output['features'].append({
                "type": "Feature",
                "geometry": mapping(transmitter_point),
                "properties": {
                    "channel": feature['properties']['channel'],
                    "lms_application_id": lms_application_id,
                    "elevation": transmitter_elevation
                },
            })
            transmitter_sites_added.add(transmitter_key)

        for vertex in feature['geometry']['coordinates'][0]:
            vertex_point = Point(vertex[0], vertex[1])
            line = LineString([vertex_point, transmitter_point])
            # print(f"processing vertex {i}...")

            # Outward sampling modification: Calculate additional buffers based on the vertex to transmitter distance
            # outward_distance = vertex_point.distance(transmitter_point) * 0.1
            # print(outward_distance)
            # num_outward_samples = int(outward_distance // (line.length / sampling_resolution))
            
            vertex_elevation = add_elevation(vertex_point, raster, band_array) if raster else None
            output['features'].append({
                "type": "Feature",
                "geometry": mapping(vertex_point),
                "properties": {
                    "transmitter_site": feature['properties']['transmitter_site'],
                    "channel": feature['properties']['channel'],
                    "lms_application_id": lms_application_id,
                    "sampling_level": 0,
                    "elevation": vertex_elevation
                },
            })

            progress_bar.update(sampling_resolution + 1)  # +1 to account for the vertex itself and its samples

            # Inward sampling
            sampled_points = sample_points_on_line(line, sampling_resolution)
            for i, point in enumerate(sampled_points, start=1):
                elevation = add_elevation(point, raster, band_array) if raster else None
                output['features'].append({
                    "type": "Feature",
                    "geometry": mapping(point),
                    "properties": {
                        "elevation": elevation,
                        "channel": feature['properties']['channel'],
                        "lms_application_id": lms_application_id,
                        "sampling_level": i
                    },
                })

            # Outward sampling
            sampled_points_outward = sample_points_on_line(line, sampling_resolution * 2, outward=True)
            for i, point in enumerate(sampled_points_outward, start=1):
                elevation = add_elevation(point, raster, band_array) if raster else None
                output['features'].append({
                    "type": "Feature",
                    "geometry": mapping(point),
                    "properties": {
                        "elevation": elevation,
                        "channel": feature['properties']['channel'],
                        "lms_application_id": lms_application_id,
                        "sampling_level": -i
                    },
                })

    with open(output_geojson, 'w') as file:
        geojson.dump(output, file, indent=4)

    with open(transmitter_output_geojson, 'w') as file:
        geojson.dump(transmitter_sites_output, file, indent=4)  

    progress_bar.close() 


# init
input_geojson = 'src/assets/data/internal/temp/simplified/FM_service_contour_downsample12_FMinfoJoin_polygon_20240324_simplified.geojson'
output_geojson = 'src/assets/data/internal/temp/FM_service_contour_downsample12_5step_FMinfoJoin_polygon_20240324.geojson'
transmitter_output_geojson = 'src/assets/data/internal/fcc/fm/processed/FM_transmitter_sites.geojson'
generate_spokes_with_sampling(input_geojson, output_geojson, transmitter_output_geojson, dem_path, sampling_resolution=4)

print("done.")