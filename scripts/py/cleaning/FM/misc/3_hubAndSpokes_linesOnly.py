import geojson
from shapely.geometry import Point, LineString, mapping

def generate_spokes_from_geojson(input_geojson, output_geojson):
    # Load the input GeoJSON file
    with open(input_geojson, 'r') as file:
        data = geojson.load(file)

    # Prepare the output GeoJSON structure
    output = {
        "type": "FeatureCollection",
        "features": []
    }

    # Iterate over each feature in the input GeoJSON
    for feature in data['features']:
        # Extract the transmitter site location and convert it to a Point
        transmitter_location = feature['properties']['transmitter_site'].split(', ')
        transmitter_point = Point(float(transmitter_location[0]), float(transmitter_location[1]))

        # Iterate over each vertex in the polygon's coordinates
        for vertex in feature['geometry']['coordinates'][0]:  # Assuming only one polygon per feature
            # Convert the vertex to a Point
            vertex_point = Point(vertex[0], vertex[1])
            
            # Create a LineString from the transmitter site to the vertex
            line = LineString([transmitter_point, vertex_point])

            # Add the line geometry to the output GeoJSON structure
            output['features'].append({
                "type": "Feature",
                "geometry": mapping(line),
                "properties": {},  # Add any desired properties here
            })

    # Write the output GeoJSON to a file
    with open(output_geojson, 'w') as file:
        geojson.dump(output, file, indent=4)

# Example usage
input_geojson = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_polygon.geojson'  # Change this to the path of your input file
output_geojson = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes.geojson'  # The output file name
generate_spokes_from_geojson(input_geojson, output_geojson)
