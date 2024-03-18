import json
from shapely.geometry import Point, Polygon, mapping
from math import atan2, pi
from shapely.ops import unary_union
import numpy as np
import cProfile

def main():
    def load_geojson(file_path):
        with open(file_path, 'r') as file:
            return json.load(file)

    def group_and_sort_features(features):
        print("grouping + sorting ...")
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
        print("constructing polylines ...")
        polylines_with_elevation = []
        for key, features in groups.items():
            # coords rounded to 5 decimals here
            points_with_elevation = [(round(feature['geometry']['coordinates'][0], 5), round(feature['geometry']['coordinates'][1], 5), feature['properties']['elevation']) for feature in features]
            # Ensure the loop is closed by adding the first point at the end, including elevation
            if points_with_elevation[0][:2] != points_with_elevation[-1][:2]:
                points_with_elevation.append(points_with_elevation[0])
            # Extract properties from the first feature as representative for the group
            propTemplate_feature = features[0]['properties']
            polyline_with_elevation = {
                "coordinates": points_with_elevation, 
                "key": key,
                "channel": propTemplate_feature.get("channel"),  # Include channel
                "transmitter_site": propTemplate_feature.get("transmitter_site")  # Include transmitter_site
            }
            polylines_with_elevation.append(polyline_with_elevation)
        return polylines_with_elevation

    def generate_output_geojson(polylines_with_elevation):
        print("outputting to geojson ...")
        features = []
        for polyline in polylines_with_elevation:
            # Apply rounding here to ensure precision
            rounded_coordinates = [(round(x, 5), round(y, 5)) for x, y, _ in polyline["coordinates"]]
            # Ensure the loop is closed by re-adding the first point at the end
            if rounded_coordinates[0] != rounded_coordinates[-1]:
                rounded_coordinates.append(rounded_coordinates[0])
            polygon = Polygon(rounded_coordinates)
            elevation_data = [z for _, _, z in polyline["coordinates"]]
            
            feature = {
                "type": "Feature",
                "geometry": mapping(polygon),
                "properties": {
                    "elevation_data": elevation_data,
                    "channel": polyline.get("channel"), 
                    "transmitter_site": polyline.get("transmitter_site"), 
                    "key": polyline["key"]
                }
            }
            features.append(feature)
        
        return {
            "type": "FeatureCollection",
            "features": features
        }
    
    def remove_duplicate_features(output_geojson):
        print("postprocessing duplicate keys ...")
        unique_keys = set()
        unique_features = []

        for feature in output_geojson['features']:
            key = feature['properties']['key']
            if key not in unique_keys:
                unique_features.append(feature)
                unique_keys.add(key)

        return {
            "type": "FeatureCollection",
            "features": unique_features
        }


    # Load the input GeoJSON file
    file_path = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes_infoJoin.geojson'
    geojson_data = load_geojson(file_path)

    # Process the GeoJSON data
    features = geojson_data['features']
    groups = group_and_sort_features(features)
    polylines = construct_polylines(groups)
    
    # Generate output GeoJSON and remove duplicates
    output_geojson_preprocessed = generate_output_geojson(polylines)
    output_geojson = remove_duplicate_features(output_geojson_preprocessed)

    # Save the deduplicated output GeoJSON to a file
    output_file_path = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes_infoJoin_processed.geojson'
    with open(output_file_path, 'w') as f:
        json.dump(output_geojson, f, indent=4)

    print("done.")

if __name__ == '__main__':
    cProfile.run('main()')