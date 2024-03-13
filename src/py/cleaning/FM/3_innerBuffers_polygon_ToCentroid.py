from shapely.geometry import shape, mapping
from shapely.affinity import scale
import geojson

def create_concentric_polygons(geojson_input, num_rings=10, scale_factor=0.7):
    with open(geojson_input, 'r') as file:
        data = geojson.load(file)
    
    new_features = []

    for feature in data['features']:
        original_polygon = shape(feature['geometry'])
        centroid = original_polygon.centroid

        for i in range(num_rings):
            # Rescale the polygon towards its centroid
            scaled_polygon = scale(original_polygon, xfact=scale_factor**i, yfact=scale_factor**i, origin=centroid)
            
            # Create a new feature with the scaled polygon
            new_feature = geojson.Feature(geometry=mapping(scaled_polygon))
            new_features.append(new_feature)

    # Create a new GeoJSON FeatureCollection
    new_feature_collection = geojson.FeatureCollection(new_features)

    # Write the modified polygons to a new GeoJSON file
    output_file = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_polygon_scaled.geojson'
    with open(output_file, 'w') as file:
        geojson.dump(new_feature_collection, file)

    print(f"Concentric polygons created and saved to {output_file}")

# Example usage
geojson_input = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_polygon.geojson'
create_concentric_polygons(geojson_input)
