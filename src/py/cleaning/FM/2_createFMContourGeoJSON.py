import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, LineString, Polygon
import os
import ast

# Load the data from the JSON file
input_file = 'src/assets/data/fcc/fm/processed/FM_service_contour_testClean.json'  
data = pd.read_json(input_file, dtype=str)

# output info
use_case = "FM_contours_AOI"
output_path = os.path.join("src/assets/data/fcc/fm/processed", use_case)
extension = ".geojson"

# Adjusted Functions to create geometries
def create_point_feature(lon, lat, properties):
    return {
        'type': 'Feature',
        'properties': properties,
        'geometry': {
            'type': 'Point',
            'coordinates': [lon, lat]
        }
    }

def create_linestring_feature(coordinates, properties):
    line = LineString(coordinates)
    return {
        'type': 'Feature',
        'properties': properties,
        'geometry': line.__geo_interface__
    }

def create_polygon_feature(coordinates, properties):
    # Ensure the Polygon is closed by adding the first point at the end, if needed
    if coordinates[0] != coordinates[-1]:
        coordinates.append(coordinates[0])
    polygon = Polygon(coordinates)
    return {
        'type': 'Feature',
        'properties': properties,
        'geometry': polygon.__geo_interface__
    }

features_points = []
features_lines = []
features_polygons = []

# Iterate over each row and create geometries
for index, row in data.iterrows():
    coords_str = row['coordinates']
    try:
        coords_dict = ast.literal_eval(coords_str)  # Safely evaluate the string to a dict
    except (ValueError, SyntaxError) as e:
        print(f"Error parsing coordinates at row {index}: {e}")
        continue

    properties = {
        'transmitter_site': row['transmitter_site'],
        'lms_application_id': row['lms_application_id']
    }

    coordinates = [tuple(map(float, v.split(','))) for v in coords_dict.values()]

    # Assuming you want to create multiple point features for each coordinate in a row
    for lon, lat in coordinates:
        features_points.append(create_point_feature(lon, lat, properties))

    # Assuming each row's coordinates form a single line or polygon
    features_lines.append(create_linestring_feature(coordinates, properties))
    features_polygons.append(create_polygon_feature(coordinates, properties))

# Convert lists of features into GeoDataFrames
gdf_points = gpd.GeoDataFrame.from_features(features_points)
gdf_lines = gpd.GeoDataFrame.from_features(features_lines)
gdf_polygons = gpd.GeoDataFrame.from_features(features_polygons)

# Set the CRS for each GeoDataFrame
for gdf in [gdf_points, gdf_lines, gdf_polygons]:
    gdf.set_crs(epsg=4326, inplace=True)

# Save the GeoDataFrames as GeoJSON files
gdf_points.to_file(f"{output_path}_point{extension}", driver='GeoJSON')
gdf_lines.to_file(f"{output_path}_line{extension}", driver='GeoJSON')
gdf_polygons.to_file(f"{output_path}_polygon{extension}", driver='GeoJSON')

print("GeoJSON files have been created.")
