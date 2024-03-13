import geojson
from shapely.geometry import Point, LineString, mapping
import rasterio

def sample_points_on_line(line, num_points):
    """Generate evenly spaced points along a line."""
    distances = [i / num_points * line.length for i in range(1, num_points + 1)]
    return [line.interpolate(distance) for distance in distances]

def add_elevation(point, raster):
    """Get elevation for a point from a raster."""
    # Transform point coordinates to raster coordinates
    row, col = raster.index(point.x, point.y)
    # Read the raster value at the given row, col
    return raster.read(1)[row, col]

def generate_spokes_with_sampling(input_geojson, output_geojson, dem_path=None):
    # Load the input GeoJSON file
    with open(input_geojson, 'r') as file:
        data = geojson.load(file)
    
    # Optional: Load the DEM raster
    raster = rasterio.open(dem_path) if dem_path else None

    # Prepare the output GeoJSON structure
    output = {
        "type": "FeatureCollection",
        "features": []
    }

    # Iterate over each feature in the input GeoJSON
    for feature in data['features']:
        transmitter_location = feature['properties']['transmitter_site'].split(', ')
        transmitter_point = Point(float(transmitter_location[0]), float(transmitter_location[1]))
        lms_application_id = feature['properties']['lms_application_id']

        for vertex in feature['geometry']['coordinates'][0]:  # Assuming only one polygon per feature
            vertex_point = Point(vertex[0], vertex[1])
            line = LineString([transmitter_point, vertex_point])

            # Add the vertex point (end of the spoke) with sampling_level 0
            output['features'].append({
                "type": "Feature",
                "geometry": mapping(vertex_point),
                "properties": {
                    "transmitter_site": feature['properties']['transmitter_site'],
                    "lms_application_id": lms_application_id,
                    "sampling_level": 0
                },
            })

            # Sample points along the line
            sampled_points = sample_points_on_line(line, 4)  # Adjust to 9 because the vertex is already included as 0

            for i, point in enumerate(sampled_points, start=1):  # Start at 1 because 0 is the vertex point
                elevation = add_elevation(point, raster) if raster else None
                # Add point geometries with elevation and properties to the output
                output['features'].append({
                    "type": "Feature",
                    "geometry": mapping(point),
                    "properties": {
                        "elevation": elevation,
                        "transmitter_site": feature['properties']['transmitter_site'],
                        "lms_application_id": lms_application_id,
                        "sampling_level": i  # Reflects the position along the spoke's progress
                    },
                })

    # Write the output GeoJSON to a file
    with open(output_geojson, 'w') as file:
        geojson.dump(output, file, indent=4)

# Example usage
input_geojson = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_polygon.geojson'  # Change this to the path of your input file
output_geojson = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes.geojson'  # The output file name
dem_path = None  # The DEM raster file path (optional for now)
generate_spokes_with_sampling(input_geojson, output_geojson, dem_path)
