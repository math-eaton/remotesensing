import os

# Set the path to your directory with the CSV files
directory_path = r'D:\mheaton\cartography\gsapp\colloquium_iii\data\openCellID'

# Name of the CSV file whose headers should not be removed
headers_csv = 'headers.csv'

# Function to remove the first line from a CSV file
def remove_first_line(file_path):
    # Read the content of the CSV file
    with open(file_path, mode='r', newline='', encoding='utf-8') as csvfile:
        lines = csvfile.readlines()
    
    # Remove the first line
    updated_content = lines[1:]
    
    # Write the updated content back to the CSV file
    with open(file_path, mode='w', newline='', encoding='utf-8') as csvfile:
        csvfile.writelines(updated_content)

# Iterate through the files in the directory and remove the first line from each
for filename in os.listdir(directory_path):
    if filename.endswith('.csv') and filename != headers_csv:  # Ignore the 'headers.csv'
        file_path = os.path.join(directory_path, filename)
        remove_first_line(file_path)

print("first line removed from CSVs")