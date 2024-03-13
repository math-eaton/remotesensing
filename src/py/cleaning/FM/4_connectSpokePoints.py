import json
from shapely.geometry import Point, Polygon, mapping
from math import atan2, pi
from shapely.ops import unary_union
import numpy as np

def load_geojson(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)

def group_and_sort_features(features):
    groups = {}
    for feature in features:
        # Construct the unique key
        key = f'{feature["properties"]["lms_application_id"]}_{feature["properties"]["sampling_level"]}'
        if key not in groups:
            groups[key] = []
        groups[key].append(feature)
    
    # Sort each group based on the angle relative to the transmitter site
    for key, group in groups.items():
        transmitter_coords = group[0]['properties']['transmitter_site'].split(", ")
        transmitter_point = Point(float(transmitter_coords[0]), float(transmitter_coords[1]))
        
        def sort_key(feature):
            point = Point(feature['geometry']['coordinates'])
            angle = atan2(point.y - transmitter_point.y, point.x - transmitter_point.x)
            return angle
        
        groups[key] = sorted(group, key=sort_key)
    
    return groups

def construct_polylines(groups):
    polylines_with_elevation = []
    for key, features in groups.items():
        points_with_elevation = [(feature['geometry']['coordinates'][0], feature['geometry']['coordinates'][1], feature['properties']['elevation']) for feature in features]
        # Ensure the loop is closed by adding the first point at the end, including elevation
        if points_with_elevation[0][:2] != points_with_elevation[-1][:2]:
            points_with_elevation.append(points_with_elevation[0])
        polyline_with_elevation = {"coordinates": points_with_elevation, "key": key}
        polylines_with_elevation.append(polyline_with_elevation)
    return polylines_with_elevation

def generate_output_geojson(polylines_with_elevation):
    features = []
    for polyline in polylines_with_elevation:
        # Convert the list of (x, y, z) tuples into a polygon and a separate elevation array
        polygon = Polygon([p[:2] for p in polyline["coordinates"]])
        elevation_data = [p[2] for p in polyline["coordinates"]]
        
        feature = {
            "type": "Feature",
            "geometry": mapping(polygon),
            "properties": {
                "elevation_data": elevation_data,
                "key": polyline["key"]
            }
        }
        features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features
    }

# Main processing flow
file_path = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes.geojson'
geojson_data = load_geojson(file_path)
features = geojson_data['features']
groups = group_and_sort_features(features)
polylines = construct_polylines(groups)
output_geojson = generate_output_geojson(polylines)

# Optionally, save the output GeoJSON to a file
output_file_path = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes_processed.geojson'
with open(output_file_path, 'w') as f:
    json.dump(output_geojson, f, indent=2)
