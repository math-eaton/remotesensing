import os
import csv

# Set the path to your directory with the CSV files
directory_path = r'D:\mheaton\cartography\gsapp\colloquium_iii\data\openCellID'

# Name of the CSV file from which to take the headers row
headers_csv = 'headers.csv'

# Read the headers from the specified CSV file
headers = []
with open(os.path.join(directory_path, headers_csv), mode='r', newline='', encoding='utf-8') as csvfile:
    reader = csv.reader(csvfile)
    for row in reader:
        headers = row
        break  # Only read the first row

# Function to prepend the headers to a CSV file
def prepend_headers_to_csv(file_path, headers):
    # Read the content of the CSV file
    with open(file_path, mode='r', newline='', encoding='utf-8') as csvfile:
        content = csvfile.readlines()
    
    # Prepend the headers row
    content.insert(0, ','.join(headers) + '\n')
    
    # Write the updated content back to the CSV file
    with open(file_path, mode='w', newline='', encoding='utf-8') as csvfile:
        csvfile.writelines(content)

# Iterate through the files in the directory and prepend headers
for filename in os.listdir(directory_path):
    if filename.endswith('.csv') and filename != headers_csv:  # Ignore the 'append.csv'
        file_path = os.path.join(directory_path, filename)
        prepend_headers_to_csv(file_path, headers)

print("Headers have been prepended to the CSV files.")
