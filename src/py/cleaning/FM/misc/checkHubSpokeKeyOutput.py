import json



def process_geojson_keys(geojson_input, output_file):
    """
    Process the 'key' properties in a GeoJSON file to check their format,
    and write the results to a text file.

    Parameters:
    - geojson_input: Path to the GeoJSON file.
    - output_file: Path to the output text file.
    """
    with open(geojson_input, 'r') as file:
        data = json.load(file)
    
    keys_with_underscore = []
    keys_without_underscore = []

    print("extracting ...")
    
    for feature in data['features']:
        key_value = feature['properties'].get('key', '')
        # Check if 'key' contains an underscore followed by additional characters
        if '_' in key_value and key_value.split('_', 1)[1]:
            keys_with_underscore.append(key_value)
        else:
            keys_without_underscore.append(key_value)

    print("writing output ...")
    
    # Write the results to the output file
    with open(output_file, 'w') as file:
        file.write("Keys with underscore and additional characters:\n")
        for key in sorted(keys_with_underscore):
            file.write(f"- {key}\n")
        file.write("\nKeys without underscore or without additional characters:\n")
        for key in sorted(keys_without_underscore):
            file.write(f"- {key}\n")

# Example usage
geojson_input = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes_infoJoin_processed.geojson' # Update this path to your GeoJSON file
output_file = 'src/assets/data/fcc/fm/processed/hubSpoke_summary.txt' # Update this path to where you want the output

process_geojson_keys(geojson_input, output_file)

print(f"output written to {output_file}.")