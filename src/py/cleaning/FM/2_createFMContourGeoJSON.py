import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, LineString, Polygon
import os
import ast

# Load the data from the JSON file
input_file = 'src/assets/data/fcc/fm/processed/FM_service_contour_testClean.json'
data = pd.read_json(input_file, dtype=str)

# Output info
use_case = "FM_contours_AOI"
output_path = os.path.join("src/assets/data/fcc/fm/processed", use_case)

# Function to parse a single coordinate
def parse_coordinate(coord_str):
    try:
        lon, lat = map(float, coord_str.split(','))
        return lon, lat
    except (ValueError, TypeError):
        return None
    

# Function to create LineString or Polygon geometry
def create_geometry(coords, geometry_type):
    valid_coords = [parse_coordinate(coord) for coord in coords.values() if parse_coordinate(coord)]
    # Ensure geometry closes for Polygon
    if geometry_type == "Polygon" and valid_coords[0] != valid_coords[-1]:
        valid_coords.append(valid_coords[0])
    if geometry_type == "LineString":
        return LineString(valid_coords)
    elif geometry_type == "Polygon":
        return Polygon(valid_coords)

# Initialize dictionaries to hold geometry data
geometry_dicts = {'point': {'geometry': [], 'properties': []},
                  'line': {'geometry': [], 'properties': []},
                  'polygon': {'geometry': [], 'properties': []}}

# Iterate over each row and create geometries
for index, row in data.iterrows():
    coords_str = row['coordinates']
    try:
        coords = ast.literal_eval(coords_str)  # Safely evaluate the string to a dict
    except (ValueError, SyntaxError) as e:
        print(f"Error parsing coordinates at row {index}: {e}")
        continue  # Skip this row or handle the error as needed

    props = row.to_dict()  # Adjust based on necessary properties

    if not isinstance(coords, dict):
        raise ValueError(f"Expected 'coords' to be a dict, got {type(coords)}")
    
    # Points
    for coord_str in coords.values():
        point = parse_coordinate(coord_str)
        if point:
            geometry_dicts['point']['geometry'].append(Point(point))
            geometry_dicts['point']['properties'].append(props)
    
    # LineString and Polygon
    for geom_type in ['line', 'polygon']:
        geom = create_geometry(coords, geom_type.capitalize())
        if geom:
            geometry_dicts[geom_type]['geometry'].append(geom)
            geometry_dicts[geom_type]['properties'].append(props)

# Convert dictionaries to GeoDataFrames and set CRS
gdfs = {}
for geom_type, geom_dict in geometry_dicts.items():
    gdfs[geom_type] = gpd.GeoDataFrame(geom_dict['properties'], geometry=geom_dict['geometry'])
    gdfs[geom_type].set_crs(epsg=4326, inplace=True)
    # Save the GeoDataFrames as GeoJSON files
    gdfs[geom_type].to_file((f"{output_path}_{geom_type}.geojson"), driver='GeoJSON')

print("GeoJSON files have been created.")