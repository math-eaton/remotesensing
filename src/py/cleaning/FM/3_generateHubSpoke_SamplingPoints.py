import geojson
from shapely.geometry import Point, LineString, mapping
import rasterio

# Path to the Digital Elevation Model (DEM) file
dem_path = 'src/assets/data/usgs/usgs150m_wgs84/usgs150mWGS84.tif' 

def sample_points_on_line(line, num_points):
    """
    Generate evenly spaced points along a line. Adjusted to include variable sampling resolution,
    including handling zero sampling points where only vertex points are returned.
    """
    if num_points > 0:
        distances = [i / num_points * line.length for i in range(1, num_points + 1)]
        return [line.interpolate(distance) for distance in distances]
    return []

def add_elevation(point, raster, band_array):
    """
    Get elevation for a point from a preloaded raster band array. This function is unchanged
    from the original script.
    """
    row, col = raster.index(point.x, point.y)
    elevation = band_array[row, col]
    if elevation == raster.nodata:
        return None
    else:
        return round(float(elevation), 2)
    
def generate_spokes_with_sampling(input_geojson, output_geojson, dem_path=None, sampling_resolution=9):
    """
    Generate spokes with variable sampling points. This function now includes a 'sampling_resolution'
    parameter to control the number of sampling points created along each spoke.
    """
    with open(input_geojson, 'r') as file:
        data = geojson.load(file)
    
    raster = rasterio.open(dem_path) if dem_path else None
    band_array = raster.read(1) if dem_path else None  # Read the first band into memory, if DEM path is provided

    output = {
        "type": "FeatureCollection",
        "features": []
    }

    for feature in data['features']:
        # Extract transmitter location and ID from properties
        transmitter_location = feature['properties']['transmitter_site'].split(', ')
        transmitter_point = Point(float(transmitter_location[0]), float(transmitter_location[1]))
        lms_application_id = feature['properties']['lms_application_id']

        for vertex in feature['geometry']['coordinates'][0]:  # Loop over vertices assuming one polygon per feature
            vertex_point = Point(vertex[0], vertex[1])
            line = LineString([transmitter_point, vertex_point])

            # Optional: Add elevation data to vertex point, if DEM is provided
            vertex_elevation = add_elevation(vertex_point, raster, band_array) if raster else None

            # Always add the vertex point with sampling level 0 and elevation
            output['features'].append({
                "type": "Feature",
                "geometry": mapping(vertex_point),
                "properties": {
                    "transmitter_site": feature['properties']['transmitter_site'],
                    "lms_application_id": lms_application_id,
                    "sampling_level": 0,
                    "elevation": vertex_elevation
                },
            })

            # Generate sampled points along the line based on the specified sampling resolution
            sampled_points = sample_points_on_line(line, sampling_resolution)

            for i, point in enumerate(sampled_points, start=1):
                elevation = add_elevation(point, raster, band_array) if raster else None
                output['features'].append({
                    "type": "Feature",
                    "geometry": mapping(point),
                    "properties": {
                        "elevation": elevation,
                        "transmitter_site": feature['properties']['transmitter_site'],
                        "lms_application_id": lms_application_id,
                        "sampling_level": i  # Reflects the position along the spoke
                    },
                })

    with open(output_geojson, 'w') as file:
        geojson.dump(output, file, indent=4)

# init
input_geojson = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_polygon.geojson'
output_geojson = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes.geojson'
generate_spokes_with_sampling(input_geojson, output_geojson, dem_path, sampling_resolution=5)