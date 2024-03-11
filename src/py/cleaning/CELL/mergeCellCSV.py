import os
import pandas as pd

def merge_spreadsheets(directory: str, output_filename: str, headers_csv: str = 'headers.csv', chunk_size: int = 10000):
    # Define the column schema with data types for optimization
    dtypes = {
        'radio': 'category', 'mcc': 'int32', 'net': 'int32',
        'area': 'int32', 'cellid': 'int32', 'unit': 'int32', 'lon': 'float32',
        'lat': 'float32', 'range': 'int32', 'samples': 'int32', 
        'changeable': 'int8', 'created': 'int32', 'updated': 'int32', 
        'average_signal': 'int32'
    }
    
    # Get all the spreadsheet filenames in the directory, excluding headers_csv
    spreadsheet_files = [f for f in os.listdir(directory) if f.endswith('.csv') and f != headers_csv]
    
    # Prepare the CSV writer to write chunks to the output file
    first_chunk = True
    for filename in spreadsheet_files:
        filepath = os.path.join(directory, filename)
        # Process each file in chunks
        for chunk in pd.read_csv(filepath, chunksize=chunk_size, dtype=dtypes):
            # If first chunk, write header, else skip header
            header = first_chunk
            chunk.to_csv(output_filename, mode='a', index=False, header=header)
            first_chunk = False

    return output_filename

# Example usage:
directory_path = r'D:\mheaton\cartography\gsapp\colloquium_iii\data\openCellID'
output_file = r'D:\mheaton\cartography\gsapp\colloquium_iii\data\openCellID\merged\openCellID_USA_merged.csv'
merged_filename = merge_spreadsheets(directory_path, output_file)
print(f"Merged spreadsheet saved as {merged_filename}")
