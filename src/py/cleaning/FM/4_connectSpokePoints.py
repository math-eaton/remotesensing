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
    polylines = []
    for key, features in groups.items():
        points = [Point(feature['geometry']['coordinates']) for feature in features]
        # Ensure the loop is closed by adding the first point at the end
        if points[0] != points[-1]:
            points.append(points[0])
        polyline = Polygon([[point.x, point.y] for point in points])
        polylines.append(polyline)
    return polylines

def generate_output_geojson(polylines):
    features = []
    for polyline in polylines:
        feature = {
            "type": "Feature",
            "geometry": mapping(polyline),
            "properties": {}
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
