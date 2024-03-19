import geojson
from shapely.geometry import Point, LineString, mapping
import rasterio

# Path to the Digital Elevation Model (DEM) file
dem_path = 'src/assets/data/usgs/usgs150m_wgs84/usgs150mWGS84.tif' 


geojson.geometry.DEFAULT_PRECISION = 4

print("sampling points ...")

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
    
def generate_spokes_with_sampling(input_geojson, output_geojson, transmitter_output_geojson, dem_path=None, sampling_resolution=4):

    print("generating ...")

    """
        Generate spokes with variable sampling points and outputs the transmitter sites to a separate
    GeoJSON file. This function reads an input GeoJSON, creates evenly spaced points along the lines
    from a central transmitter site to the vertices of the polygons defined in the GeoJSON. The
    number of sampling points along each line can be controlled by the sampling_resolution parameter.
    The function outputs a new GeoJSON file with these sampled points and a separate GeoJSON file for
    transmitter sites, optionally including elevation data if a DEM file path is provided.
    """


    with open(input_geojson, 'r') as file:
        data = geojson.load(file)
    
    raster = rasterio.open(dem_path) if dem_path else None
    band_array = raster.read(1) if dem_path else None

    output = {
        "type": "FeatureCollection",
        "features": []
    }
    transmitter_sites_output = {
        "type": "FeatureCollection",
        "features": []
    }
    transmitter_sites_added = set()

    for feature in data['features']:
        transmitter_location = feature['properties']['transmitter_site'].split(', ')
        transmitter_point = Point(float(transmitter_location[0]), float(transmitter_location[1]))
        transmitter_key = f"{transmitter_location[0]},{transmitter_location[1]}"
        lms_application_id = feature['properties']['lms_application_id']

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

            sampled_points = sample_points_on_line(line, sampling_resolution)
            for i, point in enumerate(sampled_points, start=1):
                elevation = add_elevation(point, raster, band_array) if raster else None
                output['features'].append({
                    "type": "Feature",
                    "geometry": mapping(point),
                    "properties": {
                        "elevation": elevation,
                        # removing transmitter_site output property to save on space
                        # "transmitter_site": feature['properties']['transmitter_site'],
                        "channel": feature['properties']['channel'],
                        "lms_application_id": lms_application_id,
                        "sampling_level": i
                    },
                })

    # Write the main output GeoJSON
    with open(output_geojson, 'w') as file:
        geojson.dump(output, file, indent=4)

    # Write the transmitter sites output GeoJSON
    with open(transmitter_output_geojson, 'w') as file:
        geojson.dump(transmitter_sites_output, file, indent=4)

        
# init
input_geojson = 'src/assets/data/fcc/fm/processed/FM_service_contour_downsample8_FMinfoJoin_polygon_20240319.geojson'
output_geojson = 'src/assets/data/fcc/fm/processed/FM_service_contour_downsample8_15step_20240319.geojson'
transmitter_output_geojson = 'src/assets/data/fcc/fm/processed/FM_transmitter_sites.geojson'
generate_spokes_with_sampling(input_geojson, output_geojson, transmitter_output_geojson, dem_path, sampling_resolution=14)

print("done.")