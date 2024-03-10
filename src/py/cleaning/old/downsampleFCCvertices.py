import json

def reverse_coordinates(coordinate_string):
    # Split the string, strip extra spaces, reverse, and join with comma and space
    lat, lon = coordinate_string.split(',')
    return f"{lon.strip()}, {lat.strip()}"

def downsample_polar_coordinates(input_filename, output_filename, limit=20):
    records = []  # Initialize a list to hold all record dictionaries

    with open(input_filename, 'r') as infile:
        headers = infile.readline().strip().split('|')
        transmitter_site_index = headers.index('transmitter_site')
        end_index = headers.index('^')
        
        # Calculate the indices of the headers for downsampled coordinates
        downsampled_indices = list(range(transmitter_site_index + 1, end_index, 3))[:120]
        downsampled_headers = [headers[i] for i in downsampled_indices]

        # Process each record in the file, up to the limit
        record_count = 0
        for line in infile:
            if record_count >= limit:
                break  # Stop processing if the limit is reached

            fields = line.strip().split('|')
            # Strip additional info fields to remove extra whitespace
            additional_info = [field.strip() for field in fields[:transmitter_site_index]]  
            transmitter_site = reverse_coordinates(fields[transmitter_site_index])
            polar_coordinates = fields[transmitter_site_index + 1:end_index]
            # Reverse and format each coordinate, and select every 3rd coordinate, up to the first 120
            downsampled_coordinates = [reverse_coordinates(polar_coordinates[i]) for i in range(0, len(polar_coordinates), 3)][:120]
            
            # Construct a dictionary for the current record including additional info
            record_dict = {
                'application_id': additional_info[0],
                'service': additional_info[1],
                'lms_application_id': additional_info[2],
                'dts_site_number': additional_info[3],
                'transmitter_site': transmitter_site,
                'coordinates': dict(zip(downsampled_headers, downsampled_coordinates)),
                'end': '^'
            }
            records.append(record_dict)
            
            record_count += 1

    # Write the list of record dictionaries to a JSON file
    with open(output_filename, 'w') as outfile:
        json.dump(records, outfile, indent=4)

# Example usage
input_filename = 'src/assets/data/fcc/fm/raw/FM_service_contour_sample.txt'
output_filename = 'src/assets/data/fcc/fm/processed/FM_service_contour_sample_downsampled.json'
downsample_polar_coordinates(input_filename, output_filename)
