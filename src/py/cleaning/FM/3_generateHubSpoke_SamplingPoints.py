import geojson
from shapely.geometry import Point, LineString, mapping
import rasterio

# Path to the Digital Elevation Model (DEM) file
dem_path = 'src/assets/data/usgs/usgs150m_wgs84/usgs150mWGS84.tif' 


geojson.geometry.DEFAULT_PRECISION = 4

def sample_points_on_line(line, num_points):

    print("sampling points ...")

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
    
def generate_spokes_with_sampling(input_geojson, output_geojson, dem_path=None, sampling_resolution=4):

    print("generating ...")

    with open(input_geojson, 'r') as file:
        data = geojson.load(file)
    
    raster = rasterio.open(dem_path) if dem_path else None
    band_array = raster.read(1) if dem_path else None

    output = {
        "type": "FeatureCollection",
        "features": []
    }

    for feature in data['features']:
        transmitter_location = feature['properties']['transmitter_site'].split(', ')
        transmitter_point = Point(float(transmitter_location[0]), float(transmitter_location[1]))
        lms_application_id = feature['properties']['lms_application_id']

        for vertex in feature['geometry']['coordinates'][0]:
            vertex_point = Point(vertex[0], vertex[1])
            line = LineString([vertex_point, transmitter_point])

            # Add the outer-edge vertex point with sampling_level 0
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

            # Generate and add sampled points
            sampled_points = sample_points_on_line(line, sampling_resolution)
            for i, point in enumerate(sampled_points, start=1):
                elevation = add_elevation(point, raster, band_array) if raster else None
                output['features'].append({
                    "type": "Feature",
                    "geometry": mapping(point),
                    "properties": {
                        "elevation": elevation,
                        "transmitter_site": feature['properties']['transmitter_site'],
                        "channel": feature['properties']['channel'],
                        "lms_application_id": lms_application_id,
                        "sampling_level": i
                    },
                })

    with open(output_geojson, 'w') as file:
        print("done.")
        geojson.dump(output, file, indent=4)

        
# init
input_geojson = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_infoJoin_polygon.geojson'
output_geojson = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes_infoJoin.geojson'
generate_spokes_with_sampling(input_geojson, output_geojson, dem_path, sampling_resolution=9)